'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — CLINICAL IMAGE ORCHESTRATOR
 * 
 * Generates personalized 700x400 roster images optimized for mobile briefings.
 * PROTOCOL: Proportional Branding & Strict < 60KB Weight Limit.
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

  /**
   * Satori SVG Rendering (Deterministic React-to-SVG)
   * Designed with "Clinical Document" aesthetic: High contrast, sans-serif, proportional.
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
            backgroundColor: '#FFFFFF',
            padding: `${32 * scale}px`,
            border: `${10 * scale}px solid #0F172A`,
            borderRadius: `${32 * scale}px`,
          },
        },
        // Header Hub: Professional Placement
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
              { style: { fontSize: `${22 * scale}px`, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' } },
              employeeName
            ),
            React.createElement(
              'span',
              { style: { fontSize: `${11 * scale}px`, fontWeight: 700, color: '#3B82F6', marginTop: `${4 * scale}px`, letterSpacing: '1px' } },
              `IDENTITY: ${employeeId}`
            )
          ),
          logoBase64 ? React.createElement('img', {
            src: logoBase64,
            style: { 
              height: `${40 * scale}px`, 
              width: 'auto',
              maxWidth: `${180 * scale}px`, 
              objectFit: 'contain' // Ensures no distortion and consistent proportions
            }
          }) : React.createElement('div', {
            style: { fontSize: `${16 * scale}px`, fontWeight: 900, color: '#3B82F6', letterSpacing: '2px' }
          }, 'ROC')
        ),
        // Clinical Duty Grid
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
                  padding: `${24 * scale}px`,
                  backgroundColor: i === 0 ? '#F8FAFC' : '#FFFFFF',
                  border: `${2 * scale}px solid #F1F5F9`,
                  borderRadius: `${20 * scale}px`,
                  boxShadow: i === 0 ? '0 10px 15px -3px rgba(0, 0, 0, 0.05)' : 'none',
                },
              },
              React.createElement(
                'span',
                { style: { fontSize: `${10 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px' } },
                `${d.day} • ${d.date}`
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${24 * scale}px`, fontWeight: 900, color: '#0F172A', marginTop: `${12 * scale}px`, textTransform: 'uppercase' } },
                d.shift
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${14 * scale}px`, fontWeight: 700, color: '#3B82F6', marginTop: `${4 * scale}px` } },
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
              paddingTop: `${20 * scale}px`,
              borderTop: `${1 * scale}px solid #F1F5F9`,
            },
          },
          React.createElement(
            'span',
            { style: { fontSize: `${9 * scale}px`, fontWeight: 600, color: '#94A3B8', textAlign: 'center', width: '100%', lineHeight: 1.5, textTransform: 'uppercase', letterSpacing: '0.5px' } },
            'Institutional Protocol: Arrive 15 minutes early. Coordinate with your Team Lead. Wishing you a productive session.'
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

  /**
   * RECURSIVE QUALITY LOOP: BYTE-SIZE ENFORCEMENT
   * Progressively scales the output until the buffer hits the target.
   * STRICT CEILING: 60 KB (61440 bytes).
   */
  let qualityScale = 1.0;
  let finalBuffer: Buffer | null = null;
  const MAX_BYTES = 60000; // Safe threshold for 60KB limit
  
  while (qualityScale > 0.3) {
    const svg = await renderSvg(qualityScale);
    const resvg = new Resvg(svg, {
      background: '#FFFFFF',
      fitTo: { mode: 'width', value: Math.floor(700 * qualityScale) },
    });
    
    const pngData = resvg.render();
    const currentBuffer = pngData.asPng();
    
    // VERIFY ACTUAL ENCODED BYTE SIZE
    if (currentBuffer.length <= MAX_BYTES) {
        finalBuffer = currentBuffer;
        break;
    }
    
    // Size conflict detected: reduce scale for next attempt
    qualityScale -= 0.1; 
    console.log(`ROC_SIZE_GUARD: Budget exceeded (${currentBuffer.length} bytes). Reducing scale to ${qualityScale.toFixed(1)}`);
  }

  if (!finalBuffer) {
    throw new Error("ORCHESTRATION_FAILURE: Unable to satisfy 60KB buffer constraint.");
  }

  return finalBuffer;
}