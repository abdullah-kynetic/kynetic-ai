'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { IconBold, IconItalic, IconLink, IconList, IconListNumbers } from '@tabler/icons-react';
import { Mention } from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import * as React from 'react';
import { mentionRender } from './mention-suggestion';
import { NOTE_CONTENT_CLASS } from './note-styles';

export type Teammate = { id: string; name: string };

// The mention node is stored as <span class="mention" data-mention="<user id>">@Name</span>, the
// shape the server's sanitizer keeps. The server also checks each id against the tenant's members.
const NoteMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-mention'),
        renderHTML: (attrs) => ({ 'data-mention': attrs.id })
      },
      label: {
        default: null,
        parseHTML: (el) => el.textContent?.replace(/^@/, '') ?? null,
        renderHTML: () => ({})
      }
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-mention]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'mention' }, HTMLAttributes), `@${node.attrs.label}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label}`;
  }
});

type Props = {
  teammates: Teammate[];
  initialHtml?: string;
  label: string;
  submitLabel: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (html: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Clear the editor after a successful submit (the composer); an edit form closes instead. */
  resetOnSubmit?: boolean;
};

export function NoteEditor({
  teammates,
  initialHtml = '',
  label,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
  resetOnSubmit
}: Props) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const labelId = React.useId();

  const editor = useEditor({
    immediatelyRender: false,
    // The toolbar state and the disabled Save button follow the editor's content.
    shouldRerenderOnTransaction: true,
    content: initialHtml,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
        }
      }),
      NoteMention.configure({
        suggestion: {
          char: '@',
          items: ({ query }) =>
            teammates
              .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((t) => ({ id: t.id, label: t.name })),
          render: mentionRender
        }
      })
    ],
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        class: cn(NOTE_CONTENT_CLASS, 'min-h-24 px-3 py-2 outline-none')
      }
    }
  });

  if (!editor) return null;

  const empty = editor.isEmpty;
  const applyLink = () => {
    const url = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}` }).run();
    setLinkOpen(false);
  };

  const submit = async () => {
    if (empty || pending) return;
    await onSubmit(editor.getHTML());
    if (resetOnSubmit) editor.commands.clearContent(true);
  };

  return (
    <div className='flex flex-col gap-2'>
      <span id={labelId} className='sr-only'>
        {label}
      </span>
      <div className='border-input bg-card focus-within:ring-ring rounded-lg border focus-within:ring-2'>
        <div className='border-border flex items-center gap-0.5 border-b p-1'>
          <ToolButton
            active={editor.isActive('bold')}
            name='Bold'
            onRun={() => editor.chain().focus().toggleBold().run()}
          >
            <IconBold />
          </ToolButton>
          <ToolButton
            active={editor.isActive('italic')}
            name='Italic'
            onRun={() => editor.chain().focus().toggleItalic().run()}
          >
            <IconItalic />
          </ToolButton>
          <ToolButton
            active={editor.isActive('bulletList')}
            name='Bulleted list'
            onRun={() => editor.chain().focus().toggleBulletList().run()}
          >
            <IconList />
          </ToolButton>
          <ToolButton
            active={editor.isActive('orderedList')}
            name='Numbered list'
            onRun={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <IconListNumbers />
          </ToolButton>
          <ToolButton
            active={editor.isActive('link')}
            name='Link'
            onRun={() => {
              setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '');
              setLinkOpen((o) => !o);
            }}
          >
            <IconLink />
          </ToolButton>
          <span className='text-muted-foreground ml-auto pr-2 text-xs'>Type @ to mention</span>
        </div>
        {linkOpen && (
          <div className='border-border flex items-center gap-2 border-b p-2'>
            <Input
              type='url'
              aria-label='Link address'
              placeholder='https://'
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button type='button' size='sm' onClick={applyLink}>
              {linkUrl.trim() ? 'Apply' : 'Remove'}
            </Button>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='flex justify-end gap-2'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type='button' onClick={submit} disabled={empty || pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  name,
  onRun,
  children
}: {
  active: boolean;
  name: string;
  onRun: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      aria-label={name}
      aria-pressed={active}
      className={cn(active && 'bg-muted')}
      // mousedown, not click: keep the selection in the editor while the format is applied.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      {children}
    </Button>
  );
}
