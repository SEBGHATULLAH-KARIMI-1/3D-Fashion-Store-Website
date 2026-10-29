export default function Marquee({ text }) {
  const chunk = text.repeat(8)
  return (
    <div className="marquee" aria-label={text.trim()}>
      <div className="marquee-track" aria-hidden="true">
        <span>{chunk}</span>
        <span>{chunk}</span>
      </div>
    </div>
  )
}
