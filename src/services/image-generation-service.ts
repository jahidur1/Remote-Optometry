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
    'https://cdn.jsdelivr.net/gh/googlefonts/inter@master/fonts/ttf/Inter-Black.ttf',
    'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/Inter%20(Web)/Inter-Black.ttf'
  ];

  for (const url of sources) {
    try {
      const response = await fetch(url, { 
        cache: 'force-cache',
        signal: AbortSignal.timeout(10000)
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
  const id = (shiftId || '').toUpperCase();
  
  if (name.includes('WEEK OFF') || name.includes('WEEK-OFF') || id === 'NONE') return '#10B981'; // Emerald
  if (name.includes('SUPER OPENING') || name.includes('OPENING') || id === 'SO' || id === 'OP') return '#2563EB'; // Blue
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
            padding: `${80 * scale}px`,
            fontFamily: 'Inter',
          },
        },
        // A. BRAND HEADER HUB
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: `${80 * scale}px`,
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement(
              'span',
              { style: { fontSize: `${32 * scale}px`, fontWeight: 900, color: '#102A43', textTransform: 'uppercase', letterSpacing: '1px' } },
              'TEAM REMOTE OPTOMETRY'
            ),
            React.createElement(
              'span',
              { style: { fontSize: `${16 * scale}px`, fontWeight: 700, color: '#2563EB', marginTop: `${6 * scale}px`, letterSpacing: '2px' } },
              'WORKFORCE SHIFT SCHEDULE'
            )
          ),
          logoBase64 ? React.createElement('img', {
            src: logoBase64,
            style: { 
              height: `${100 * scale}px`, 
              width: 'auto',
              maxWidth: `${320 * scale}px`, 
              objectFit: 'contain'
            }
          }) : null
        ),

        // B. PROFESSIONAL IDENTITY
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', marginBottom: `${80 * scale}px` } },
          React.createElement(
            'span',
            { style: { fontSize: `${44 * scale}px`, fontWeight: 900, color: '#172B4D', textTransform: 'uppercase', letterSpacing: '-1px' } },
            `HELLO, ${employeeName.split(' ')[0]}`
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', marginTop: `${12 * scale}px`, gap: `${12 * scale}px` } },
            React.createElement('div', { style: { width: `${8 * scale}px`, height: `${8 * scale}px`, backgroundColor: '#2563EB', borderRadius: '50%' } }),
            React.createElement(
              'span',
              { style: { fontSize: `${20 * scale}px`, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px' } },
              `ID Trace: ${employeeId}`
            )
          )
        ),

        // C. CLINICAL SCHEDULE SECTION
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: `${40 * scale}px` } },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: `${16 * scale}px`, marginBottom: `${10 * scale}px` } },
            React.createElement(
              'span',
              { style: { fontSize: `${16 * scale}px`, fontWeight: 900, color: '#102A43', letterSpacing: '5px', textTransform: 'uppercase' } },
              'YOUR UPCOMING SCHEDULE'
            ),
            React.createElement('div', { style: { flex: 1, height: '2px', backgroundColor: '#E2E8F0' } })
          ),
          nextTwoDays.map((d, i) => {
            const shiftColor = getShiftColor(d.shift, d.shiftId);
            const isOff = d.shift.toUpperCase().includes('WEEK OFF') || d.shift.toUpperCase().includes('WEEK-OFF') || (d.shiftId || '').toUpperCase() === 'NONE';
            
            return React.createElement(
              'div',
              {
                key: i,
                style: {
                  display: 'flex',
                  backgroundColor: '#FFFFFF',
                  borderRadius: `${48 * scale}px`,
                  border: `2px solid #E2E8F0`,
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
                },
              },
              // Color Indicator Pulse
              React.createElement('div', { style: { width: `${20 * scale}px`, backgroundColor: shiftColor } }),
              
              // Card Content Hub
              React.createElement(
                'div',
                { style: { flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${60 * scale}px` } },
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${18 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '2px' } },
                    `DAY 0${i + 1} — ${d.day}`
                  ),
                  React.createElement(
                    'span',
                    { style: { fontSize: `${26 * scale}px`, fontWeight: 800, color: '#172B4D', marginTop: `${8 * scale}px` } },
                    d.date
                  )
                ),
                React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
                  React.createElement(
                    'span',
                    { style: { fontSize: `${38 * scale}px`, fontWeight: 900, color: isOff ? '#10B981' : '#102A43', textTransform: 'uppercase', textAlign: 'right' } },
                    d.shift
                  ),
                  !isOff && React.createElement(
                    'span',
                    { style: { fontSize: `${22 * scale}px`, fontWeight: 800, color: '#2563EB', marginTop: `${8 * scale}px`, tabularNums: true } },
                    d.time
                  )
                )
              )
            );
          })
        ),

        // E. INSTITUTIONAL PROTOCOL MESSAGE
        React.createElement(
          'div',
          {
            style: {
              marginTop: 'auto',
              padding: `${50 * scale}px`,
              backgroundColor: '#FFFFFF',
              borderRadius: `${40 * scale}px`,
              border: `2px dashed #E2E8F0`,
              display: 'flex',
              alignItems: 'center',
              gap: `${20 * scale}px`
            },
          },
          React.createElement(
            'div',
            { style: { width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#22D3EE', borderRadius: '50%' } }
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${16 * scale}px`, fontWeight: 700, color: '#64748B', lineHeight: 1.6, flex: 1, textTransform: 'uppercase' } },
            'Please report to the office on time and follow your assigned shift timings. Wishing you a productive day!'
          )
        ),

        // F. CORPORATE FOOTER
        React.createElement(
          'div',
          {
            style: {
              marginTop: `${80 * scale}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderTop: `2px solid #E2E8F0`,
              paddingTop: `${50 * scale}px`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${20 * scale}px`, fontWeight: 900, color: '#102A43', textTransform: 'uppercase', letterSpacing: '1px' } },
            'TEAM REMOTE OPTOMETRY'
          ),
          React.createElement(
            'span',
            { style: { fontSize: `${14 * scale}px`, fontWeight: 600, color: '#94A3B8', marginTop: `${10 * scale}px`, textTransform: 'uppercase', letterSpacing: '3px' } },
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
