import { Fragment, type ReactNode } from 'react';
import { documentFor, RICH_PREFIX, safeLink, type RichNode } from './rich-text.js';
function render(node: RichNode, key: number): ReactNode {
  const children = node.content?.map(render);
  const style = node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined;
  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>;
    case 'paragraph':
      return (
        <p key={key} style={style}>
          {children || <br />}
        </p>
      );
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 key={key} style={style}>
          {children}
        </h3>
      ) : (
        <h2 key={key} style={style}>
          {children}
        </h2>
      );
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case 'text': {
      let text: ReactNode = node.text;
      for (const mark of node.marks || [])
        switch (mark.type) {
          case 'bold':
            text = <strong>{text}</strong>;
            break;
          case 'italic':
            text = <em>{text}</em>;
            break;
          case 'underline':
            text = <u>{text}</u>;
            break;
          case 'strike':
            text = <s>{text}</s>;
            break;
          case 'code':
            text = <code>{text}</code>;
            break;
          case 'link': {
            const href = safeLink(mark.attrs?.href);
            if (href)
              text = (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {text}
                </a>
              );
            break;
          }
        }
      return <Fragment key={key}>{text}</Fragment>;
    }
    default:
      return null;
  }
}
export default function RichContent({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  if (!value.startsWith(RICH_PREFIX))
    return (
      <div className={`rich-content rich-legacy ${className}`}>
        {value.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
          /^https?:\/\//.test(part) && safeLink(part) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              {part}
            </a>
          ) : (
            part
          ),
        )}
      </div>
    );
  try {
    return <div className={`rich-content ${className}`}>{render(documentFor(value), 0)}</div>;
  } catch {
    return <div className="notice">This text could not be displayed.</div>;
  }
}
