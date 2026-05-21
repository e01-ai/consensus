/** CJK input → CJK output language signaling. */

export type Lang = 'zh' | 'en'

export function detectLang(s: string): Lang {
  const cjk = (s.match(/[㐀-鿿豈-﫿぀-ヿ]/g) || []).length
  const total = s.replace(/\s/g, '').length || 1
  return (cjk / total > 0.2) ? 'zh' : 'en'
}

export const LANG_LINE: Record<Lang, string> = {
  zh: 'ALWAYS reply in Chinese (Simplified). 用中文回答。',
  en: 'ALWAYS reply in English.',
}
