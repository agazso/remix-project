import React, { useState, useRef, useEffect } from 'react';
import Editor, { DiffEditor, useMonaco, loader, Monaco } from "@monaco-editor/react";

import './remix-ui-editor.css';

type cursorPosition = {
  startLineNumber: number,
  startColumn: number,
  endLineNumber: number,
  endColumn: number
}
/* eslint-disable-next-line */
export interface EditorUIProps {
  theme: string
  currentFile: string
  editorAPI:{
    api: {
      findMatches: (uri: string, value: string) => any
      addModel: (value: string, language: string, uri: string, readOnly: boolean) => void
      disposeModel: (uri: string) => void,
      addBreakpoint: (uri: string, row: number, className: string) => void
      removeBreakpooint: (uri: string, row: number) => void
      removeAllBreakpoints: (uri: string) => void

      addMarker: (uri: string, row: number, className: string) => void
      removeMarker: (uri: string, row: number) => void

      addAnnotation: (uri: string, row: number, className: string) => void
      removeAnnotation: (uri: string, row: number) => void
      getFontSize: () => number
      setFontSize: (size: number) => void
      getValue: (uri: string) => string
      getCursorPosition: () => cursorPosition
      revealLine: (revealLine: number) => void
      focus: () => void
      setWordWrap: (wrap: boolean) => void
      setValue: (uri: string, value: string) => void
    }
  }
}

export const EditorUI = (props: EditorUIProps) => {
  const [models, setModels] = useState({})
  const [decorations, setDecorations] = useState({})
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
 
  useEffect(() => {
    if (!monacoRef.current) return
    monacoRef.current.editor.setTheme(props.theme)
  }, [props.theme])

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ readOnly: models[props.currentFile].readOnly })
  }, [props.currentFile])

  props.editorAPI.api.findMatches = (uri: string, value: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) return model.findMatches(value)
  }

  props.editorAPI.api.addModel = (value: string, language: string, uri: string, readOnly: boolean) => {
    console.log('adding model', uri)
    monacoRef.current.editor.createModel(value, language, monacoRef.current.Uri.parse(uri))
    setModels(prevState => {
      prevState[uri] = { value, language, uri, readOnly }
      return prevState
    })
    return
  }

  props.editorAPI.api.disposeModel = (uri: string) => {
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    model.dispose()
    setModels(prevState => {
      delete prevState[uri]
      const files = Object.keys(models)
      return prevState
    })
    return
  }

  props.editorAPI.api.addAnnotation = (uri: string, row: number, message: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const newDecoration = {
        range: new monacoRef.current.Range(row, 1, row, 1),
        type: 'annotation',
        options: {
          isWholeLine: false,
          hoverMessage: message,
        }
      }
      decorations[uri].push(newDecoration)
      setDecorations(decorations)
      model.deltaDecorations([], [newDecoration])
    }
  }

  props.editorAPI.api.removeAnnotation = (uri: string, row: number) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const toRemove = []
      decorations[uri] = decorations[uri].filter((el) => {
        if (el.range.startLineNumber === row && el.range.endLineNumber === row && el.type === 'annotation') {
          toRemove.push(el)
          return false
        }
        return true
      })
      setDecorations(decorations)
      model.deltaDecorations(toRemove, [])
    }
  }

  props.editorAPI.api.addMarker = (uri: string, row: number, className: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const newDecoration = {
        range: new monacoRef.current.Range(row, 1, row, 1),
        type: 'marker',
        options: {
          isWholeLine: true,
          className: className
        }
      }
      decorations[uri].push(newDecoration)
      setDecorations(decorations)
      model.deltaDecorations([], [newDecoration])
    }
  }

  props.editorAPI.api.removeMarker = (uri: string, row: number) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const toRemove = []
      decorations[uri] = decorations[uri].filter((el) => {
        if (el.range.startLineNumber === row && el.range.endLineNumber === row && el.type === 'marker') {
          toRemove.push(el)
          return false
        }
        return true
      })
      setDecorations(decorations)
      model.deltaDecorations(toRemove, [])
    }
  }

  props.editorAPI.api.addBreakpoint = (uri: string, row: number, className: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const newDecoration = {
        range: new monacoRef.current.Range(row, 1, row, 1),
        type: 'annotation',
        options: {
          isWholeLine: false,
          className: className
        }
      }
      decorations[uri].push(newDecoration)
      setDecorations(decorations)
      model.deltaDecorations([], [newDecoration])
    }
  }

  props.editorAPI.api.removeBreakpooint = (uri: string, row: number) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      if (!decorations[uri]) decorations[uri] = []
      const toRemove = []
      decorations[uri] = decorations[uri].filter((el) => {
        if (el.range.startLineNumber === row && el.range.endLineNumber === row && el.type === 'breakpoint') {
          toRemove.push(el)
          return false
        }
        return true
      })
      setDecorations(decorations)
      model.deltaDecorations(toRemove, [])
    }
  }

  props.editorAPI.api.removeAllBreakpoints = (uri: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      decorations[uri] = []
      setDecorations(decorations)
      model.deltaDecorations([], [])
    }
  }
  
  props.editorAPI.api.getFontSize = () => {
    return editorRef.current.getOption(34).fontSize
  }

  props.editorAPI.api.setFontSize = (size: number) => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ 'fontSize': size })
  }

  props.editorAPI.api.getValue = (uri: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      return model.getValue()
    }
  }

  props.editorAPI.api.setValue = (uri: string, value: string) => {
    if (!editorRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(uri))
    if (model) {
      model.setValue(value)
    }
  }

  props.editorAPI.api.getCursorPosition = () => {
    if (!monacoRef.current) return
    const model = editorRef.current.getModel(monacoRef.current.Uri.parse(props.currentFile))
    if (model) {
      console.log(model.getOffsetAt(editorRef.current.getPosition()))
      return model.getOffsetAt(editorRef.current.getPosition())     
    }    
  }

  props.editorAPI.api.revealLine = (line: number) => {
    if (!editorRef.current) return
    editorRef.current.revealLine(line)
  }

  props.editorAPI.api.focus = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
  }

  props.editorAPI.api.setWordWrap = (wrap: boolean) => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ 'wordWrap': wrap ? 'on' : 'off' })
  }

  function handleEditorDidMount(editor) {
    editorRef.current = editor
    monacoRef.current.editor.setTheme(props.theme)
  }

  function handleEditorWillMount(monaco) {
    monacoRef.current = monaco    
  }

  return (
    <Editor
       width="100%"
       height="100%"
       path={props.currentFile}
       language={models[props.currentFile] ? models[props.currentFile].language : 'text'}
       value={models[props.currentFile] ? models[props.currentFile].value : ''}
       onMount={handleEditorDidMount}
       beforeMount={handleEditorWillMount}
     />
  )
};

export default EditorUI;
