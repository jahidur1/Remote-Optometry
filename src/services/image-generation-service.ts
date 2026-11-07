
'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL IMAGE ORCHESTRATOR v6.0
 * 
 * Generates corporate-grade portrait roster images for WhatsApp delivery.
 * DESIGN: Modern, minimal, clean and elegant.
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
 * Fetches institutional Inter-Black font using a resilient multi-source pulse.
 */
async function loadFont() {
  const sources = [
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuDyfMZg.ttf',
    'https://cdn.jsdelivr.net/gh/googlefonts/inter@master/fonts/ttf/Inter-Black.ttf'
  ];

  for (const url of sources) {
    try {
      const response = await fetch(url, { 
        cache: 'force-cache',
        signal: AbortSignal.timeout(8000)
      });
      
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (e: any) {
      console.warn(`FONT_PULSE_WARN: Failed source ${url} - ${e.message}`);
    }
  }

  throw new Error("FONT_FETCH_FAILURE: Registry exhausted all sources.");
}

/**
 * getShiftColor
 * Returns professional indicators based on shift category.
 */
function getShiftColor(shiftName: string, shiftId: string = '') {
  const name = shiftName.toUpperCase();
  const id = shiftId.toUpperCase();
  
  if (name.includes('WEEK OFF') || name.includes('WEEK-OFF')) return '#10B981'; // Emerald
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

  const renderSvg = async (scale = 1) => {
    const width = 1080 * scale;
    const height = 1350 * scale;

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
              height: `${80 * scale}px`, 
              width: 'auto',
              maxWidth: `${260 * scale}px`, 
              objectFit: 'contain'
            }
          }) : null
        ),

        // B. EMPLOYEE INFORMATION
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', marginBottom: `${60 * scale}px` } },
          React.createElement(
            'span',
            { style: { fontSize: `${38 * scale}px`, fontWeight: 900, color: '#172B4D', textTransform: 'uppercase' } },
            `HELLO, ${employeeName.split(' ')[0]}`
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${18 * scale}px`, fontWeight: 600, color: '#64748B', marginTop: `${8 * scale}px` } },
            `Institutional ID: ${employeeId}`
          )
        ),

        // C. UPCOMING SCHEDULE SECTION
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: `${32 * scale}px` } },
          React.createElement(
            'span',
            { style: { fontSize: `${14 * scale}px`, fontWeight: 900, color: '#102A43', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: `${10 * scale}px` } },
            'YOUR UPCOMING SCHEDULE'
          ),
          nextTwoDays.map((d, i) => {
            const shiftColor = getShiftColor(d.shift, d.shiftId);
            const isOff = d.shift.toUpperCase().includes('WEEK OFF') || d.shift.toUpperCase().includes('WEEK-OFF');
            
            return React.createElement(
              'div',
              {
                key: i,
                style: {
                  display: 'flex',
                  backgroundColor: '#FFFFFF',
                  borderRadius: `${40 * scale}px`,
                  border: `1px solid #E2E8F0`,
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                },
              },
              // Color Indicator Bar
              React.createElement('div', { style: { width: `${16 * scale}px`, backgroundColor: shiftColor } }),
              
              // Card Content
              React.createElement(
                'div',
                { style: { flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${50 * scale}px` } },
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${16 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px' } },
                    `DAY 0${i + 1} — ${d.day}`
                  ),
                  React.createElement(
                    'span',
                    { style: { fontSize: `${22 * scale}px`, fontWeight: 700, color: '#172B4D', marginTop: `${6 * scale}px` } },
                    d.date
                  )
                ),
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${32 * scale}px`, fontWeight: 900, color: isOff ? '#10B981' : '#102A43', textTransform: 'uppercase' } },
                    d.shift
                  ),
                  !isOff && React.createElement(
                    'span',
                    { style: { fontSize: `${20 * scale}px`, fontWeight: 700, color: '#2563EB', marginTop: `${6 * scale}px` } },
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
              borderRadius: `${32 * scale}px`,
              border: `1px dashed #E2E8F0`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${14 * scale}px`, fontWeight: 600, color: '#64748B', textAlign: 'center', width: '100%', lineHeight: 1.6 } },
            'Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!'
          )
        ),

        // F. FOOTER
        React.createElement(
          'div',
          {
            style: {
              marginTop: `${60 * scale}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderTop: `1px solid #E2E8F0`,
              paddingTop: `${40 * scale}px`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${18 * scale}px`, fontWeight: 900, color: '#102A43', textTransform: 'uppercase' } },
            'TEAM REMOTE OPTOMETRY'
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${12 * scale}px`, fontWeight: 600, color: '#94A3B8', marginTop: `${8 * scale}px`, textTransform: 'uppercase', letterSpacing: '2px' } },
            'Your schedule. Your responsibility. Your team.'
          )
        )
      ),
      {
        width,
        height,
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
   * STRICT CEILING: 61,440 bytes.
   */
  let qualityScale = 1.0;
  let finalBuffer: Buffer | null = null;
  const MAX_BYTES = 60000; // Targeting 60KB with safety margin
  
  while (qualityScale > 0.3) {
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
