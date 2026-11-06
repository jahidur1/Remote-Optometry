
'use server';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

/**
 * ROC WORKFORCE — DYNAMIC IMAGE ORCHESTRATOR
 * 
 * Generates personalized 700x400 roster images.
 * Optimized for WhatsApp delivery (< 60KB).
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

  // Inter Font logic would go here if needed, defaulting to sans-serif
  
  const svg = await satori(
    React.createElement(
      'div',
      {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          padding: '40px',
          fontFamily: 'sans-serif',
          border: '12px solid #0F172A',
          borderRadius: '40px',
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
            marginBottom: '40px',
          },
        },
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column' } },
          React.createElement(
            'span',
            { style: { fontSize: '28px', fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' } },
            employeeName
          ),
          React.createElement(
            'span',
            { style: { fontSize: '14px', fontWeight: 700, color: '#3B82F6', marginTop: '4px', letterSpacing: '2px' } },
            `ID: ${employeeId}`
          )
        ),
        logoBase64 ? React.createElement('img', {
          src: logoBase64,
          style: { height: '50px', objectFit: 'contain' }
        }) : React.createElement('div', {
          style: { fontSize: '20px', fontWeight: 900, color: '#3B82F6' }
        }, 'REMOTE OPTOMETRY')
      ),
      // Pulse Label
      React.createElement(
        'div',
        { style: { marginBottom: '30px', fontSize: '12px', fontWeight: 800, color: '#94A3B8', letterSpacing: '4px', textTransform: 'uppercase' } },
        'Upcoming Clinical Schedule'
      ),
      // Assignments Grid
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '20px' } },
        nextTwoDays.map((d, i) => 
          React.createElement(
            'div',
            {
              key: i,
              style: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                backgroundColor: i === 0 ? '#F8FAFC' : '#FFFFFF',
                border: '2px solid #F1F5F9',
                borderRadius: '24px',
              },
            },
            React.createElement(
              'span',
              { style: { fontSize: '12px', fontWeight: 900, color: '#64748B', textTransform: 'uppercase' } },
              `${d.day} • ${d.date}`
            ),
            React.createElement(
              'span',
              { style: { fontSize: '24px', fontWeight: 900, color: '#3B82F6', marginTop: '12px', textTransform: 'uppercase' } },
              d.shift
            ),
            React.createElement(
              'span',
              { style: { fontSize: '14px', fontWeight: 700, color: '#94A3B8', marginTop: '4px' } },
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
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '20px',
            borderTop: '1px solid #F1F5F9',
          },
        },
        React.createElement(
          'span',
          { style: { fontSize: '10px', fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '1px' } },
          'Institutional Registry Protocol v6.0'
        ),
        React.createElement(
          'span',
          { style: { fontSize: '10px', fontWeight: 900, color: '#10B981', textTransform: 'uppercase' } },
          'Verified schedule'
        )
      )
    ),
    {
      width: 700,
      height: 400,
    }
  );

  const resvg = new Resvg(svg, {
    background: '#FFFFFF',
    fitTo: { mode: 'width', value: 700 },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
