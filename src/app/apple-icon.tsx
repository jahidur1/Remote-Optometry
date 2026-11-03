import { ImageResponse } from 'next/og'
 
/**
 * Institutional Apple Touch Icon
 * Generates a high-intensity 180x180 icon for mobile home screens.
 */
export const runtime = 'edge'
 
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          background: '#0F172A',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 15c-2.209 0-4-1.791-4-4s1.791-4 4-4c1.105 0 2.052.448 2.728 1.172L12 11l3.272-2.828c.676-.724 1.623-1.172 2.728-1.172 2.209 0 4 1.791 4 4s-1.791 4-4 4c-1.105 0-2.052-.448-2.728-1.172L12 11l-3.272 2.828C8.052 14.552 7.105 15 6 15z" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
