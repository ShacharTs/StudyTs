import type { ToolExecutionResult } from '../toolExecutionResult';
import type { AiTool } from '@core/shared/aiTypes';

export const WEB_RESEARCH_TOOLS: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_web_content',
      description: 'Fetch and extract text/markdown content from a documentation or web URL.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The HTTP/HTTPS URL to fetch and read',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_youtube_details',
      description: 'Fetch metadata and title for a YouTube video URL or ID.',
      parameters: {
        type: 'object',
        properties: {
          videoIdOrUrl: {
            type: 'string',
            description: 'YouTube video ID (e.g. "dQw4w9WgXcQ") or full YouTube URL',
          },
        },
        required: ['videoIdOrUrl'],
      },
    },
  },
];

export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const match = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(input.trim())) return input.trim();
  return null;
}


function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function fetchWebContent(args: Record<string, unknown>, fetchFn: typeof fetch): Promise<ToolExecutionResult> {
  const url = args.url as string;
  if (!url || !/^https?:\/\//i.test(url)) {
    return { success: false, error: 'Invalid URL. Must start with http:// or https://' };
  }
  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: Failed to fetch URL` };
    }
    const text = await res.text();
    const cleanText = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);
    return { success: true, data: { url, content: cleanText } };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

async function fetchYoutubeDetails(args: Record<string, unknown>, fetchFn: typeof fetch): Promise<ToolExecutionResult> {
  const raw = args.videoIdOrUrl as string;
  const videoId = extractYouTubeVideoId(raw);
  if (!videoId) {
    return { success: false, error: `Invalid YouTube video ID or URL: "${raw}"` };
  }
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetchFn(oembedUrl);
    if (!res.ok) {
      return { success: true, data: { videoId, title: `YouTube Video (${videoId})` } };
    }
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      success: true,
      data: {
        videoId,
        title: data.title || `Video ${videoId}`,
        author: data.author_name || 'Unknown Channel',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      },
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function executeWebResearchTool(
  name: string,
  args: Record<string, unknown>,
  fetchFn: typeof fetch = fetch
): Promise<ToolExecutionResult> {
  if (name === 'fetch_web_content') return fetchWebContent(args, fetchFn);
  if (name === 'fetch_youtube_details') return fetchYoutubeDetails(args, fetchFn);
  return { success: false, error: `Unknown tool: ${name}` };
}
