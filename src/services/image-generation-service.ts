
'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL IMAGE ORCHESTRATOR v6.0
 * 
 * Generates corporate-grade 1080x1350 roster images for WhatsApp delivery.
 * PROTOCOL: Pure-Logic Rendering & Strict < 60KB Quality Guard.
 */

type RosterDay = {
  date: string;
  day: string;
  shift: string;
  time: string;
  shiftId?: string;
};

/**
 * loadFont
 * Fetches institutional Inter font to support satori layout engine.
 */
async function loadFont() {
  const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/inter/Inter-Black.ttf';
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error("FONT_FETCH_FAILURE");
  return await response.arrayBuffer();
}

/**
 * getShiftColor
 * Returns professional indicators based on shift category.
 */
function getShiftColor(shiftName: string, shiftId: string = '') {
  const name = shiftName.toUpperCase();
  const id = shiftId.toUpperCase();
  
  if (name.includes('WEEK OFF') || name.includes('WEEK-OFF')) return '#10B981'; // Green
  if (name.includes('SUPER OPENING') || name.includes('OPENING')) return '#2563EB'; // Blue
  if (name.includes('MID SHIFT') || id === 'MD') return '#22D3EE'; // Cyan
  if (name.includes('CLOSING') || id.startsWith('C') || id === 'SC') return '#102A43'; // Navy
  return '#64748B'; // Slate fallback
}

export async function generateRosterImage(input: {
  employeeName: string;
  employeeId: string;
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, logoBase64, nextTwoDays } = input;
  const fontData = await loadFont();

  /**
   * Satori SVG Rendering (Deterministic React-to-SVG)
   * Premium Corporate Design Protocol.
   */
  const renderSvg = async (scale = 1) => {
    return await satori(
      React.createElement(
        'div',
        {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#F4F7FB',
            padding: `${60 * scale}px`,
            fontFamily: 'Inter',
          },
        },
        // A. BRAND HEADER
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: `${60 * scale}px`,
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement(
              'span',
              { style: { fontSize: `${28 * scale}px`, fontWeight: 900, color: '#102A43', textTransform: 'uppercase', letterSpacing: '1px' } },
              'TEAM REMOTE OPTOMETRY'
            ),
            React.createElement(
              'span',
              { style: { fontSize: `${14 * scale}px`, fontWeight: 700, color: '#2563EB', marginTop: `${4 * scale}px`, letterSpacing: '2px' } },
              'WORKFORCE SHIFT SCHEDULE'
            )
          ),
          logoBase64 ? React.createElement('img', {
            src: logoBase64,
            style: { 
              height: `${60 * scale}px`, 
              width: 'auto',
              maxWidth: `${220 * scale}px`, 
              objectFit: 'contain'
            }
          }) : null
        ),

        // B. EMPLOYEE INFORMATION
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', marginBottom: `${50 * scale}px` } },
          React.createElement(
            'span',
            { style: { fontSize: `${32 * scale}px`, fontWeight: 900, color: '#172B4D', textTransform: 'uppercase' } },
            `HELLO, ${employeeName.split(' ')[0]}`
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${16 * scale}px`, fontWeight: 600, color: '#64748B', marginTop: `${8 * scale}px` } },
            `Institutional ID: ${employeeId}`
          )
        ),

        // C. UPCOMING SCHEDULE SECTION
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: `${24 * scale}px` } },
          React.createElement(
            'span',
            { style: { fontSize: `${12 * scale}px`, fontWeight: 900, color: '#102A43', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: `${8 * scale}px` } },
            'YOUR UPCOMING SCHEDULE'
          ),
          nextTwoDays.map((d, i) => {
            const shiftColor = getShiftColor(d.shift, d.shiftId);
            const isOff = d.shift.toUpperCase().includes('WEEK OFF');
            
            return React.createElement(
              'div',
              {
                key: i,
                style: {
                  display: 'flex',
                  backgroundColor: '#FFFFFF',
                  borderRadius: `${24 * scale}px`,
                  border: `1px solid #E2E8F0`,
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                },
              },
              // Color Indicator Bar
              React.createElement('div', { style: { width: `${12 * scale}px`, backgroundColor: shiftColor } }),
              
              // Card Content
              React.createElement(
                'div',
                { style: { flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${40 * scale}px` } },
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${12 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' } },
                    `DAY 0${i + 1} — ${d.day}`
                  ),
                  React.createElement(
                    'span',
                    { style: { fontSize: `${18 * scale}px`, fontWeight: 700, color: '#172B4D', marginTop: `${4 * scale}px` } },
                    d.date
                  )
                ),
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${24 * scale}px`, fontWeight: 900, color: isOff ? '#10B981' : '#102A43', textTransform: 'uppercase' } },
                    d.shift
                  ),
                  !isOff && React.createElement(
                    'span',
                    { style: { fontSize: `${16 * scale}px`, fontWeight: 700, color: '#2563EB', marginTop: `${4 * scale}px` } },
                    d.time
                  )
                )
              )
            );
          })
        ),

        // E. FRIENDLY REMINDER
        React.createElement(
          'div',
          {
            style: {
              marginTop: 'auto',
              padding: `${40 * scale}px`,
              backgroundColor: '#F8FAFC',
              borderRadius: `${20 * scale}px`,
              border: `1px dashed #E2E8F0`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${13 * scale}px`, fontWeight: 600, color: '#64748B', textAlign: 'center', width: '100%', lineHeight: 1.5 } },
            'Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!'
          )
        ),

        // F. FOOTER
        React.createElement(
          'div',
          {
            style: {
              marginTop: `${40 * scale}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderTop: `1px solid #E2E8F0`,
              paddingTop: `${30 * scale}px`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${14 * scale}px`, fontWeight: 900, color: '#102A43', textTransform: 'uppercase' } },
            'TEAM REMOTE OPTOMETRY'
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${10 * scale}px`, fontWeight: 600, color: '#94A3B8', marginTop: `${4 * scale}px`, textTransform: 'uppercase' } },
            'Your schedule. Your responsibility. Your team.'
          )
        )
      ),
      {
        width: 1080 * scale,
        height: 1350 * scale,
        fonts: [
          {
            name: 'Inter',
            data: fontData,
            weight: 900,
            style: 'normal',
          },
        ],
      }
    );
  };

  /**
   * RECURSIVE QUALITY LOOP: BYTE-SIZE ENFORCEMENT
   * STRICT CEILING: 60 KB (61440 bytes).
   */
  let qualityScale = 1.0;
  let finalBuffer: Buffer | null = null;
  const MAX_BYTES = 61000; // Safety threshold
  
  while (qualityScale > 0.4) {
    const svg = await renderSvg(qualityScale);
    const resvg = new Resvg(svg, {
      background: '#F4F7FB',
      fitTo: { mode: 'width', value: Math.floor(1080 * qualityScale) },
    });
    
    const pngData = resvg.render();
    const currentBuffer = pngData.asPng();
    
    if (currentBuffer.length <= MAX_BYTES) {
        finalBuffer = currentBuffer;
        break;
    }
    
    qualityScale -= 0.1; 
  }

  if (!finalBuffer) {
    throw new Error("ORCHESTRATION_FAILURE: Unable to satisfy 60KB buffer constraint.");
  }

  return finalBuffer;
}
