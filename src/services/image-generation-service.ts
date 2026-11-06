
'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — DYNAMIC IMAGE ORCHESTRATOR
 * 
 * Generates personalized 700x400 roster images.
 * Optimized for WhatsApp delivery with progressive compression (Strict < 60KB).
 */

type RosterDay = {
  date: string;
  day: string;
  shift: string;
  time: string;
};

export async function generateRosterImage(input: {
  employeeName: string;
  employeeId: string;
  logoBase64?: string;
  nextTwoDays: RosterDay[];
}): Promise<Buffer> {
  const { employeeName, employeeId, logoBase64, nextTwoDays } = input;

  // Satori SVG Rendering
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
            padding: `${40 * scale}px`,
            fontFamily: 'sans-serif',
            border: `${12 * scale}px solid #0F172A`,
            borderRadius: `${40 * scale}px`,
          },
        },
        // Header
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: `${40 * scale}px`,
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement(
              'span',
              { style: { fontSize: `${28 * scale}px`, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' } },
              employeeName
            ),
            React.createElement(
              'span',
              { style: { fontSize: `${14 * scale}px`, fontWeight: 700, color: '#3B82F6', marginTop: `${4 * scale}px`, letterSpacing: '2px' } },
              `ID: ${employeeId}`
            )
          ),
          logoBase64 ? React.createElement('img', {
            src: logoBase64,
            style: { height: `${50 * scale}px`, objectFit: 'contain' }
          }) : React.createElement('div', {
            style: { fontSize: `${20 * scale}px`, fontWeight: 900, color: '#3B82F6' }
          }, 'ROC WORKFORCE')
        ),
        // Grid
        React.createElement(
          'div',
          { style: { display: 'flex', gap: `${20 * scale}px` } },
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
                  borderRadius: `${24 * scale}px`,
                },
              },
              React.createElement(
                'span',
                { style: { fontSize: `${12 * scale}px`, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' } },
                `${d.day} • ${d.date}`
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${24 * scale}px`, fontWeight: 900, color: '#3B82F6', marginTop: `${12 * scale}px`, textTransform: 'uppercase' } },
                d.shift
              ),
              React.createElement(
                'span',
                { style: { fontSize: `${14 * scale}px`, fontWeight: 700, color: '#94A3B8', marginTop: `${4 * scale}px` } },
                d.time
              )
            )
          )
        ),
        // Footer
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
            { style: { fontSize: `${11 * scale}px`, fontWeight: 600, color: '#64748B', fontStyle: 'italic', textAlign: 'center', width: '100%' } },
            'Have a great day at ROC! Please arrive on time and coordinate with your team.'
          )
        )
      ),
      {
        width: 700 * scale,
        height: 400 * scale,
      }
    );
  };

  // Progressive Quality Loop
  let qualityScale = 1.0;
  let finalBuffer: Buffer;
  
  while (qualityScale > 0.4) {
    const svg = await renderSvg(qualityScale);
    const resvg = new Resvg(svg, {
      background: '#FFFFFF',
      fitTo: { mode: 'width', value: 700 * qualityScale },
    });
    
    const pngData = resvg.render();
    finalBuffer = pngData.asPng();
    
    if (finalBuffer.length <= 61440) { // 60KB
        return finalBuffer;
    }
    qualityScale -= 0.1; // Reduce fidelity to meet strict size requirement
  }

  throw new Error("IMAGE_SIZE_CONSTRAINT_VIOLATION: Could not optimize roster image below 60KB.");
}
