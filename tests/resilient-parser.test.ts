import { describe, it, expect } from 'vitest';
import { parseSSEStreamToChatCompletion } from '../src/lib/ai/llm-client';
import { parseStoryboardFromLLMResponse } from '../src/lib/pipeline/director-agent';

describe('Resilient SSE & Markdown Parsers', () => {
  it('assembles an SSE event stream from 9router into a valid chat completion JSON', () => {
    const rawSSE = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"}}]}
data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"{\\"title\\": \\"Rumah Kokoh\\", \\"scenes\\": []}"}}]}
data: [DONE]
`;

    interface CompletionChoice {
      message: { content: string };
    }
    interface CompletionResponse {
      id: string;
      choices: CompletionChoice[];
    }

    const result = parseSSEStreamToChatCompletion(rawSSE) as unknown as CompletionResponse;
    expect(result.id).toBe('chatcmpl-123');
    expect(result.choices[0].message.content).toBe('{"title": "Rumah Kokoh", "scenes": []}');
  });

  it('handles reasoning_content from reasoning models if content is absent', () => {
    const rawSSE = `data: {"id":"chatcmpl-reason","choices":[{"delta":{"reasoning_content":"Step 1 thinking... Finished."}}]}
data: [DONE]
`;
    interface CompletionChoice {
      message: { content: string };
    }
    interface CompletionResponse {
      id: string;
      choices: CompletionChoice[];
    }

    const result = parseSSEStreamToChatCompletion(rawSSE) as unknown as CompletionResponse;
    expect(result.choices[0].message.content).toContain('Step 1 thinking');
  });

  it('parses Gemini markdown storyboard into 4 scenes matching user construction prompt', () => {
    const geminiOutput = `PALETTE:
- Background: \`#1A1D20\`
- Accent Warm: \`#F59E0B\`

SCENE 1: HOOK (0.0s - 3.0s)
- KineticHeadline: "RUMAH CEPAT RETAK?" (Highlight: "RETAK")
- Voiceover: "Baru tiga tahun, dinding sudah retak struktur dan lantai amblas?"
- Visual:
  - CameraRig: \`slow-push\`

SCENE 2: PROBLEM & MECHANISM (3.0s - 7.0s)
- KineticHeadline: "KUNCI UTAMA: STRUKTUR"
- Voiceover: "Masalah utama: kedalaman pondasi minim dan besi tulangan tidak standar."

SCENE 3: PROOF & METRICS (7.0s - 11.0s)
- KineticHeadline: "TAHAN HINGGA GENERASI"
- Voiceover: "Hitungan teknik tepat bikin rumah tahan gempa, biaya renovasi turun drastis."

SCENE 4: CTA (11.0s - 15.0s)
- KineticHeadline: "DOWNLOAD PANDUAN PONDASI"
- Voiceover: "Mau bangun rumah tanpa was-was? Download checklist struktur gratis di bio."`;

    const storyboard = parseStoryboardFromLLMResponse(geminiOutput, 'Bangun rumah tahan gempa', 'ads-ui', '9:16');
    expect(storyboard).not.toBeNull();
    expect(storyboard?.scenes).toHaveLength(4);
    expect(storyboard?.scenes[0].kineticHeadline).toBe('RUMAH CEPAT RETAK?');
    expect(storyboard?.scenes[0].voiceoverText).toContain('dinding sudah retak');
    expect(storyboard?.scenes[1].kineticHeadline).toBe('KUNCI UTAMA: STRUKTUR');
    expect(storyboard?.scenes[2].kineticHeadline).toBe('TAHAN HINGGA GENERASI');
    expect(storyboard?.scenes[3].kineticHeadline).toBe('DOWNLOAD PANDUAN PONDASI');
  });
});
