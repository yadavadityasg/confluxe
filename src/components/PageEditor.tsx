import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Undo, Redo } from "lucide-react";

type Props = {
  content: unknown;
  editable?: boolean;
  onChange?: (json: unknown) => void;
  placeholder?: string;
};

export function PageEditor({ content, editable = true, onChange, placeholder = "Start writing…" }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
    ],
    content: (content as object) ?? { type: "doc", content: [] },
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return <div className="min-h-[400px]" />;

  return (
    <div>
      {editable && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-card/95 backdrop-blur p-1">
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></TB>
          <Sep />
          <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-4 w-4" /></TB>
          <Sep />
          <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></TB>
          <TB onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            else editor.chain().focus().extendMarkRange("link").unsetLink().run();
          }} active={editor.isActive("link")}><LinkIcon className="h-4 w-4" /></TB>
          <Sep />
          <TB onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></TB>
          <TB onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></TB>
        </div>
      )}
      <EditorContent editor={editor} className="prose max-w-none" />
    </div>
  );
}

function TB({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
      {children}
    </button>
  );
}
function Sep() { return <div className="mx-1 h-5 w-px bg-border" />; }
