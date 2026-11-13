// Hand-written demo input: a TSX component with a hand-rolled dialog.
type ModalProps = { title: string; items: string[] };

export function Modal({ title, items }: ModalProps) {
  const snapshot: ModalProps = JSON.parse(JSON.stringify({ title, items }));
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <h2>{snapshot.title}</h2>
      <ul>
        {snapshot.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
