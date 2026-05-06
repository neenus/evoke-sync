import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onBlur: (html: string) => void;
  readOnly?: boolean;
}

export function BillingNotesEditor({ value, onBlur, readOnly = false }: Props) {
  const savedOnBlur = useRef(onBlur);
  savedOnBlur.current = onBlur;

  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: !readOnly,
    onBlur: ({ editor: e }) => {
      savedOnBlur.current(e.getHTML());
    },
  });

  // Sync content if value changes externally
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  return (
    <div className={`border rounded-xl overflow-hidden ${readOnly ? 'bg-gray-50' : 'bg-white'}`}>
      {!readOnly && (
        <div className="border-b border-gray-200 px-3 py-2 flex gap-2">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-xs rounded ${editor?.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-xs rounded ${editor?.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 text-xs rounded ${editor?.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`px-2 py-1 text-xs rounded ${editor?.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          >
            1. List
          </button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[120px] focus:outline-none"
      />
    </div>
  );
}
