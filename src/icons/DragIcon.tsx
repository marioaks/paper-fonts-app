export default function DragIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="9" cy="5" r=".5" />
      <circle cx="9" cy="12" r=".5" />
      <circle cx="9" cy="19" r=".5" />
      <circle cx="15" cy="5" r=".5" />
      <circle cx="15" cy="12" r=".5" />
      <circle cx="15" cy="19" r=".5" />
    </svg>
  )
}
