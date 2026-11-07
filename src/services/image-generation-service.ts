'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — DYNAMIC IMAGE ORCHESTRATOR
 * 
 * Generates personalized 700x400 roster images.
 * STRICT REQUIREMENT: Final image size MUST be <= 50KB.
 * FONT PROTOCOL: Fetches Inter font buffer for layout calculation.
 */

type RosterDay = {
  date: string;
  day: string;
  shift: string;
  time: string;
};

/**
 * loadFont
 * Fetches standard Inter font from public CDN to support satori layout engine.
 */
async function loadFont() {
  const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/inter/Inter-Black.ttf';
  const response = await fetch(fontUrl);
  if (!response.ok) throw new Error("FONT_FETCH_FAILURE");
  return await response.arrayBuffer();
}

export async function generateRosterImage(input: {
  employeeName: string;
  employeeId: string;
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, logoBase64, nextTwoDays } = input;
  const fontData = await loadFont();

  // Satori SVG Rendering (Deterministic React-to-SVG)
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
            backgroundColor: '#FFFFFF',
            padding: `${32 * scale}px`,
            border: `${10 * scale}px solid #0F172A`,
            borderRadius: `${32 * scale}px`,
          },
        },
        // Header Hub
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: `${32 * scale}px`,
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement(
              'span',
              { style: { fontSize: `${24 * scale}px`, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' } },
              employeeName
            ),
            React.createElement(
              'span',
              { style: { fontSize: `${12 * scale}px`, fontWeight: 700, color: '#3B82F6', marginTop: `${4 * scale}px`, letterSpacing: '1px' } },
              `ID: ${employeeId}`
            )
          ),
          logoBase64 ? React.createElement('img', {
            src: logoBase64,
            style: { height: `${40 * scale}px`, maxWidth: `${180 * scale}px`, objectFit: 'contain' }
          }) : React.createElement('div', {
            style: { fontSize: `${18 * scale}px`, fontWeight: 900, color: '#3B82F6' }
          }, 'ROC')
        ),
        // Clinical Grid
        React.createElement(
          'div',
          { style: { display: 'flex', gap: `${16 * scale}px` } },
          nextTwoDays.map((d, i) => 
            React.createElement(
              'div',
              {
                key: i,
                style: {
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: `${20 * scale}px`,
                  backgroundColor: i === 0 ? '#F8FAFC' : '#FFFFFF',
                  border: `${2 * scale}px solid #F1F5F9`,
                  borderRadius: `${20 * scale}px`,
                },
              },
              React.createElement(
                'span',
                { style: { fontSize: `${10 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' } },
                `${d.day} • ${d.date}`
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${20 * scale}px`, fontWeight: 900, color: '#3B82F6', marginTop: `${10 * scale}px`, textTransform: 'uppercase' } },
                d.shift
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${12 * scale}px`, fontWeight: 700, color: '#94A3B8', marginTop: `${4 * scale}px` } },
                d.time
              )
            )
          )
        ),
        // Institutional Footer
        React.createElement(
          'div',
          {
            style: {
              marginTop: 'auto',
              display: 'flex',
              paddingTop: `${16 * scale}px`,
              borderTop: `${1 * scale}px solid #F1F5F9`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${9 * scale}px`, fontWeight: 600, color: '#94A3B8', textAlign: 'center', width: '100%', lineHeight: 1.4 } },
            'Arrive on time, follow shift timings, and coordinate with your team. Wishing you a productive day!'
          )
        )
      ),
      {
        width: 700 * scale,
        height: 400 * scale,
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

  // RECURSIVE QUALITY LOOP: Progressively reduce fidelity to hit strict 50KB limit
  let qualityScale = 1.0;
  let finalBuffer: Buffer | null = null;
  
  while (qualityScale > 0.4) {
    const svg = await renderSvg(qualityScale);
    const resvg = new Resvg(svg, {
      background: '#FFFFFF',
      fitTo: { mode: 'width', value: 700 * qualityScale },
    });
    
    const pngData = resvg.render();
    const currentBuffer = pngData.asPng();
    
    // Strict 50KB constraint for Meta Media API reliability
    if (currentBuffer.length <= 51200) {
        finalBuffer = currentBuffer;
        break;
    }
    qualityScale -= 0.1; 
  }

  if (!finalBuffer) {
    throw new Error("IMAGE_OPTIMIZATION_FAILURE: Buffer weight exceeds 50KB ceiling.");
  }

  return finalBuffer;
}
