import { ImageResponse } from 'next/og'
 
/**
 * Institutional Favicon Node
 * Generates a dynamic 32x32 favicon with deep navy background and white optical symbol.
 */
export const runtime = 'edge'
 
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#0F172A',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '20%',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
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
