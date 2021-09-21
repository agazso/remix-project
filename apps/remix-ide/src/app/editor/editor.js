'use strict'
const yo = require('yo-yo')
import React from 'react' // eslint-disable-line
import ReactDOM from 'react-dom'
import { EditorUI } from '@remix-ui/editor'
import { Plugin } from '@remixproject/engine'
import * as packageJson from '../../../../../package.json'

const EventManager = require('../../lib/events')

const globalRegistry = require('../../global/registry')
const SourceHighlighters = require('./SourceHighlighters')

const profile = {
  displayName: 'Editor',
  name: 'editor',
  description: 'service - editor',
  version: packageJson.version,
  methods: ['highlight', 'discardHighlight', 'discardHighlightAt', 'clearAnnotations', 'addAnnotation', 'gotoLine']
}

class Editor extends Plugin {
  constructor () {
    super(profile)
    // Dependancies
    this._components = {}
    this._components.registry = globalRegistry
    this._deps = {
      config: this._components.registry.get('config').api,
      themeModule: this._components.registry.get('themeModule').api
    }

    this._themes = {
      light: 'light',
      dark: 'vs-dark',
      remixDark: 'vs-dark'
    }

    const translateTheme = (theme) => this._themes[theme.name === 'Dark' ? 'remixDark' : theme.quality]
    this._deps.themeModule.events.on('themeChanged', (theme) => {
      this.currentTheme = translateTheme(theme)
      this.renderComponent()
    })
    this.currentTheme = translateTheme(this._deps.themeModule.currentTheme())
    this.models = []
    // Init
    this.event = new EventManager()
    this.sessions = {}
    this.sourceAnnotationsPerFile = []
    this.readOnlySessions = {}
    this.previousInput = ''
    this.saveTimeout = null
    this.sourceHighlighters = new SourceHighlighters()
    this.emptySession = null
    this.modes = {
      sol: 'solidity',
      yul: 'solidity',
      mvir: 'move',
      js: 'javascript',
      py: 'python',
      vy: 'python',
      zok: 'zokrates',
      lex: 'lexon',
      txt: 'text',
      json: 'json',
      abi: 'json',
      rs: 'rust'
    }

    // to be implemented by the react component
    this.api = {}
  }

  render () {
    if (this.el) return this.el

    this.el = yo`
    <div id="editorView">
     
    </div>`

    this.renderComponent()

    return this.el
  }

  renderComponent () {
    ReactDOM.render(
      <EditorUI editorAPI={this} theme={this.currentTheme} currentFile={this.currentFile} />
      , this.el)
  }

  triggerEvent (name, params) {
    this.event.trigger(name, params) // internal stack
    this.emit(name, ...params) // plugin stack
  }

  onActivation () {
    this.on('sidePanel', 'focusChanged', (name) => {
      this.sourceHighlighters.hideHighlightsExcept(name)
      this.keepAnnotationsFor(name)
    })
    this.on('sidePanel', 'pluginDisabled', (name) => {
      this.sourceHighlighters.discardHighlight(name)
      this.clearAllAnnotationsFor(name)
    })
  }

  onDeactivation () {
    this.off('sidePanel', 'focusChanged')
    this.off('sidePanel', 'pluginDisabled')
  }

  highlight (position, filePath, hexColor) {
    const { from } = this.currentRequest
    this.sourceHighlighters.highlight(position, filePath, hexColor, from)
  }

  discardHighlight () {
    const { from } = this.currentRequest
    this.sourceHighlighters.discardHighlight(from)
  }

  discardHighlightAt (line, filePath) {
    const { from } = this.currentRequest
    this.sourceHighlighters.discardHighlightAt(line, filePath, from)
  }

  setTheme (type) {
    this.api.setTheme(this._themes[type])
  }

  _onChange () {
    const currentFile = this._deps.config.get('currentFile')
    if (!currentFile) {
      return
    }
    const input = this.get(currentFile)
    if (!input) {
      return
    }
    // if there's no change, don't do anything
    if (input === this.previousInput) {
      return
    }
    this.previousInput = input

    // fire storage update
    // NOTE: save at most once per 5 seconds
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = window.setTimeout(() => {
      this.triggerEvent('requiringToSaveCurrentfile', [])
    }, 5000)
  }

  _switchSession (path) {
    this.currentFile = path
    this.renderComponent()
  }

  /**
   * Get Ace mode base of the extension of the session file
   * @param {string} path Path of the file
   */
  _getMode (path) {
    if (!path) return this.modes.txt
    const root = path.split('#')[0].split('?')[0]
    let ext = root.indexOf('.') !== -1 ? /[^.]+$/.exec(root) : null
    if (ext) ext = ext[0]
    else ext = 'txt'
    return ext && this.modes[ext] ? this.modes[ext] : this.modes.txt
  }

  /**
   * Create an editor session
   * @param {string} path path of the file
   * @param {string} content Content of the file to open
   * @param {string} mode Mode for this file [Default is `text`]
   */
  _createSession (path, content, mode) {
    this.api.addModel(content, mode, path, false)
    return {
      path,
      content,
      language: mode,
      setAnnotations: (annotations) => {
        for (const annotation of annotations) {
          this.api.addAnnotation(path, annotation.row, annotation.type + ' ' + annotation.text)      
        }
      },
      addMarker: (lineColumnPos, cssClass) => {
        this.api.addMarker(path, lineColumnPos.start.line, cssClass)
      },
      removeMarker: (position) => {
        this.api.removeMarker(path, position.start.line)      
      },
      setValue: () => {
        this.api.setValue(path, content)
      },
      getValue: () => {
        this.api.getValue(path, content)
      },
      setBreakpoint: (row, className) => {
        this.api.addBreakpoint(path, row, className)
      }
    }
  }

  /**
   * Attempts to find the string in the current document
   * @param {string} string
   */
  find (string) {
    return this.api.findMatches(this.currentFile, string)
  }

  /**
   * Display an Empty read-only session
   */
  displayEmptyReadOnlySession () {
    this.currentSession = null
    this.api.addModel('', 'text', '_blank', true)
    this.api.setCurrentPath('_blank')
  }

  /**
   * Sets a breakpoint on the row number
   * @param {number} row Line index of the breakpoint
   * @param {string} className Class of the breakpoint
   */
  setBreakpoint (row, className) {
    const session = this.sessions[filePath]
    session.addBreakpoint(this.currentFile, row, className)
  }

  /**
   * Increment the font size (in pixels) for the editor text.
   * @param {number} incr The amount of pixels to add to the font.
   */
  editorFontSize (incr) {
    const newSize = this.api.getFontSize() + incr
    if (newSize >= 6) {
      this.api.setFontSize(newSize)
    }
  }

  /**
   * Set the text in the current session, if any.
   * @param {string} text New text to be place.
   */
  setText (text) {
    if (this.currentSession && this.sessions[this.currentSession]) {
      this.sessions[this.currentSession].setValue(text)
    }
  }

  /**
   * Upsert and open a session.
   * @param {string} path Path of the session to open.
   * @param {string} content Content of the document or update.
   */
  open (path, content) {
    /*
      we have the following cases:
       - URL prepended with "localhost"
       - URL prepended with "browser"
       - URL not prepended with the file explorer. We assume (as it is in the whole app, that this is a "browser" URL
    */
    if (!this.sessions[path]) {
      const session = this._createSession(path, content, this._getMode(path))
      this.sessions[path] = session
      this.readOnlySessions[path] = false
    } else if (this.sessions[path].getValue() !== content) {
      this.sessions[path].setValue(content)
    }
    this._switchSession(path)
  }

  /**
   * Upsert and Open a session and set it as Read-only.
   * @param {string} path Path of the session to open.
   * @param {string} content Content of the document or update.
   */
  openReadOnly (path, content) {
    if (!this.sessions[path]) {
      const session = this._createSession(path, content, this._getMode(path))
      this.sessions[path] = session
      this.readOnlySessions[path] = true
    }
    this._switchSession(path)
  }

  /**
   * Content of the current session
   * @return {String} content of the file referenced by @arg path
   */
  currentContent () {
    return this.get(this.current())
  }

  /**
   * Content of the session targeted by @arg path
   * if @arg path is null, the content of the current session is returned
   * @param {string} path Path of the session to get.
   * @return {String} content of the file referenced by @arg path
   */
  get (path) {
    if (!path || this.currentSession === path) {
      return this.api.getValue(path)
    } else if (this.sessions[path]) {
      return this.sessions[path].getValue()
    }
  }

  /**
   * Path of the currently editing file
   * returns `undefined` if no session is being editer
   * @return {String} path of the current session
   */
  current () {
    return this.currentSession
  }

  /**
   * The position of the cursor
   */
  getCursorPosition () {
    return this.api.getCursorPosition()
  }

  /**
   * Remove the current session from the list of sessions.
   */
  discardCurrentSession () {
    if (this.sessions[this.currentSession]) {
      delete this.sessions[this.currentSession]
      this.currentSession = null
    }
  }

  /**
   * Remove a session based on its path.
   * @param {string} path
   */
  discard (path) {
    if (this.sessions[path]) delete this.sessions[path]
    if (this.currentSession === path) this.currentSession = null
  }

  /**
   * Resize the editor, and sets whether or not line wrapping is enabled.
   * @param {boolean} useWrapMode Enable (or disable) wrap mode
   */
  resize (useWrapMode) {
    this.api.setWordWrap(useWrapMode)
  }

  /**
   * Adds a new marker to the given `Range`.
   * @param {*} lineColumnPos
   * @param {string} source Path of the session to add the mark on.
   * @param {string} cssClass css to apply to the mark.
   */
  addMarker (lineColumnPos, source, cssClass) {
    const currentRange = new Range(
      lineColumnPos.start.line,
      lineColumnPos.start.column,
      lineColumnPos.end.line,
      lineColumnPos.end.column
    )
    if (this.sessions[source]) {
      return this.sessions[source].addMarker(lineColumnPos, cssClass)
    }
    return null
  }

  /**
   * Scrolls to a line. If center is true, it puts the line in middle of screen (or attempts to).
   * @param {number} line The line to scroll to
   */
  scrollToLine (line) {
    this.api.revealLine(line)
  }

  /**
   * Remove a marker from the session
   * @param {string} position position where the marker is located
   * @param {string} source Path of the session
   */
  removeMarker (position, source) {
    if (this.sessions[source]) {
      this.sessions[source].removeMarker(position)
    }
  }

  /**
   * Clears all the annotations for the given @arg filePath and @arg plugin, if none is given, the current sesssion is used.
   * An annotation has the following shape:
      column: -1
      row: -1
      text: "browser/Untitled1.sol: Warning: SPDX license identifier not provided in source file. Before publishing, consider adding a comment containing "SPDX-License-Identifier: <SPDX-License>" to each source file. Use "SPDX-License-Identifier: UNLICENSED" for non-open-source code. Please see https://spdx.org for more information.↵"
      type: "warning"
   * @param {String} filePath
   * @param {String} plugin
   */
  clearAnnotationsByPlugin (filePath, plugin) {
    if (filePath && !this.sessions[filePath]) throw new Error('file not found' + filePath)
    const session = this.sessions[filePath]
    const path = filePath || this.currentSession

    const currentAnnotations = this.sourceAnnotationsPerFile[path]
    if (!currentAnnotations) return

    const newAnnotations = []
    for (const annotation of currentAnnotations) {
      if (annotation.from !== plugin) newAnnotations.push(annotation)
    }
    this.sourceAnnotationsPerFile[path] = newAnnotations

    this._setAnnotations(session, path)
  }

  keepAnnotationsFor (name) {
    if (!this.currentSession) return
    if (!this.sourceAnnotationsPerFile[this.currentSession]) return

    const annotations = this.sourceAnnotationsPerFile[this.currentSession]
    for (const annotation of annotations) {
      annotation.hide = annotation.from !== name
    }

    this._setAnnotations(this.sessions[this.currentFile], this.currentSession)
  }

  /**
   * Clears all the annotations for the given @arg filePath, the plugin name is retrieved from the context, if none is given, the current sesssion is used.
   * An annotation has the following shape:
      column: -1
      row: -1
      text: "browser/Untitled1.sol: Warning: SPDX license identifier not provided in source file. Before publishing, consider adding a comment containing "SPDX-License-Identifier: <SPDX-License>" to each source file. Use "SPDX-License-Identifier: UNLICENSED" for non-open-source code. Please see https://spdx.org for more information.↵"
      type: "warning"
   * @param {String} filePath
   * @param {String} plugin
   */
  clearAnnotations (filePath) {
    const { from } = this.currentRequest
    this.clearAnnotationsByPlugin(filePath, from)
  }

  /**
   * Clears all the annotations and for all the sessions for the given @arg plugin
   * An annotation has the following shape:
      column: -1
      row: -1
      text: "browser/Untitled1.sol: Warning: SPDX license identifier not provided in source file. Before publishing, consider adding a comment containing "SPDX-License-Identifier: <SPDX-License>" to each source file. Use "SPDX-License-Identifier: UNLICENSED" for non-open-source code. Please see https://spdx.org for more information.↵"
      type: "warning"
   * @param {String} filePath
   */
  clearAllAnnotationsFor (plugin) {
    for (const session in this.sessions) {
      this.clearAnnotationsByPlugin(session, plugin)
    }
  }

  /**
   * Add an annotation to the current session.
   * An annotation has the following shape:
      column: -1
      row: -1
      text: "browser/Untitled1.sol: Warning: SPDX license identifier not provided in source file. Before publishing, consider adding a comment containing "SPDX-License-Identifier: <SPDX-License>" to each source file. Use "SPDX-License-Identifier: UNLICENSED" for non-open-source code. Please see https://spdx.org for more information.↵"
      type: "warning"
   * @param {Object} annotation
   * @param {String} filePath
   */
  addAnnotation (annotation, filePath) {
    if (filePath && !this.sessions[filePath]) throw new Error('file not found' + filePath)
    const session = this.sessions[filePath]
    const path = filePath || this.currentSession

    const { from } = this.currentRequest
    if (!this.sourceAnnotationsPerFile[path]) this.sourceAnnotationsPerFile[path] = []
    annotation.from = from
    this.sourceAnnotationsPerFile[path].push(annotation)

    this._setAnnotations(session, path)
  }

  _setAnnotations (session, path) {
    const annotations = this.sourceAnnotationsPerFile[path]
    session.setAnnotations(annotations.filter((element) => !element.hide))
  }

  /**
   * Moves the cursor and focus to the specified line and column number
   * @param {number} line
   * @param {number} col
   */
  gotoLine (line, col) {
    this.api.focus()
    this.api.revealLine(line + 1)
  }
}

module.exports = Editor
