'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@trailguide/ui';
import {
  MagnifyingGlassIcon,
  LinkIcon,
  ChartBarIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  BookmarkIcon,
  ClockIcon,
  TrashIcon,
  ChevronDownIcon,
  SparklesIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
  engagementTier: string;
  ageText: string;
  selftext?: string;
}

interface ExtractedData {
  post: {
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments: number;
  };
  valuableComments: any[];
  extractionStats: {
    total: number;
    valid: number;
    extracted: number;
    percentageKept: number;
    averageScore: number;
  };
}

interface SavedResearch {
  id: string;
  name: string;
  searchType: string;
  searchQuery: string;
  postsAnalyzed: number;
  createdAt: string;
  daysRemaining?: number;
}

interface GeneratedContent {
  id: number;
  type: string;
  label: string;
  icon: string;
  content: string;
  timestamp: Date;
  focus: string;
  tone: string;
  length: string;
}

type TabType = 'url' | 'topic' | 'subreddit';
type AnalysisTab = 'qualitative' | 'data' | 'generated';

// ─── Persona Deliverables ─────────────────────────────────────────────────────

const PERSONAS = [
  'Product Manager',
  'Marketer / Copywriter',
  'Content Creator',
  'Founder / Entrepreneur',
  'UX Researcher',
];

const PERSONA_DELIVERABLES: Record<string, { id: string; label: string; icon: string; description: string }[]> = {
  'Product Manager': [
    { id: 'user_stories', label: 'User Stories', icon: '📋', description: 'Generate user stories in "As a user..." format' },
    { id: 'feature_brief', label: 'Feature Brief', icon: '📄', description: 'One-pager outlining a feature based on user needs' },
  ],
  'Marketer / Copywriter': [
    { id: 'seo_article', label: 'SEO Article', icon: '📝', description: 'Long-form blog post with real quotes' },
    { id: 'ad_copy', label: 'Ad Copy', icon: '📣', description: '3-5 ad copy variations for social/search' },
    { id: 'email_sequence', label: 'Email Sequence', icon: '📧', description: '3-5 email nurture sequence' },
    { id: 'headlines', label: 'Headlines', icon: '🎯', description: '10+ hook/headline variations' },
  ],
  'Content Creator': [
    { id: 'twitter_thread', label: 'Twitter/X Thread', icon: '🐦', description: '5-10 tweet thread with hooks' },
    { id: 'linkedin_post', label: 'LinkedIn Post', icon: '💼', description: 'Professional long-form post' },
    { id: 'youtube_outline', label: 'YouTube Outline', icon: '🎬', description: 'Video script with hook and sections' },
    { id: 'blog_draft', label: 'Blog Draft', icon: '✍️', description: 'Full article with quotes woven in' },
  ],
  'Founder / Entrepreneur': [
    { id: 'pitch_points', label: 'Pitch Talking Points', icon: '🎤', description: 'Problem/solution content for pitch deck' },
    { id: 'problem_solution', label: 'Problem-Solution Brief', icon: '💡', description: 'Structured validation document' },
  ],
  'UX Researcher': [
    { id: 'user_persona', label: 'User Persona', icon: '👤', description: 'Detailed persona based on comment patterns' },
    { id: 'research_synthesis', label: 'Research Synthesis', icon: '🔬', description: 'Themes, quotes, and recommendations' },
  ],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RedditResearchPage() {
  // Search tabs state
  const [activeTab, setActiveTab] = useState<TabType>('url');

  // URL Analysis state
  const [redditUrl, setRedditUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Topic Search state
  const [topicQuery, setTopicQuery] = useState('');
  const [topicTimeRange, setTopicTimeRange] = useState('week');
  const [topicLimit, setTopicLimit] = useState(15);
  const [topicSubredditFilter, setTopicSubredditFilter] = useState(false);
  const [topicSubreddits, setTopicSubreddits] = useState('');
  const [searchingTopic, setSearchingTopic] = useState(false);

  // Subreddit Search state
  const [subredditName, setSubredditName] = useState('');
  const [subredditTimeRange, setSubredditTimeRange] = useState('week');
  const [subredditLimit, setSubredditLimit] = useState(15);
  const [searchingSubreddit, setSearchingSubreddit] = useState(false);

  // Results state
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Persona & Analysis state
  const [selectedPersona, setSelectedPersona] = useState('');
  const [researchGoal, setResearchGoal] = useState('');
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [combinedResults, setCombinedResults] = useState<any>(null);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('qualitative');
  const [extractedPostsData, setExtractedPostsData] = useState<any[]>([]);

  // Content Generation state
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateType, setGenerateType] = useState('');
  const [generateFocus, setGenerateFocus] = useState('');
  const [generateTone, setGenerateTone] = useState('conversational');
  const [generateLength, setGenerateLength] = useState('medium');
  const [generating, setGenerating] = useState(false);

  // History state
  const [savedResearch, setSavedResearch] = useState<SavedResearch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentResearchId, setCurrentResearchId] = useState<string | null>(null);

  // Re-analyze state
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [reanalyzePersona, setReanalyzePersona] = useState('');
  const [reanalyzeGoal, setReanalyzeGoal] = useState('');

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/reddit-research/history');
      if (response.ok) {
        const data = await response.json();
        setSavedResearch(data.research || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ─── Core Actions ───────────────────────────────────────────────────────────

  const clearResults = () => {
    setSearchResults([]);
    setSelectedPosts(new Set());
    setExtractedData(null);
    setCombinedResults(null);
    setError(null);
    setStatusMessage(null);
    setProgress(0);
    setCurrentResearchId(null);
    setShowPersonaSelector(false);
    setExtractedPostsData([]);
  };

  const analyzeUrl = async () => {
    if (!redditUrl.trim()) { setError('Please enter a Reddit URL'); return; }
    if (!redditUrl.includes('reddit.com/r/') || !redditUrl.includes('/comments/')) {
      setError('Please enter a valid Reddit post URL'); return;
    }

    clearResults();
    setAnalyzing(true);
    setStatusMessage('Extracting Reddit data...');
    setProgress(20);

    try {
      const response = await fetch('/api/reddit-research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: redditUrl }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Analysis failed');

      setProgress(70);
      setExtractedData(result.extractedData);
      setExtractedPostsData([result.extractedData]);
      setShowPersonaSelector(true);
      setProgress(100);
      setStatusMessage('Data extracted! Select your persona to get AI insights.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setAnalyzing(false);
    }
  };

  const searchByTopic = async () => {
    if (!topicQuery.trim()) { setError('Please enter a topic to search'); return; }

    clearResults();
    setSearchingTopic(true);
    setStatusMessage('Searching Reddit...');
    setProgress(50);

    try {
      const response = await fetch('/api/reddit-research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'topic', topic: topicQuery, timeRange: topicTimeRange,
          subreddits: topicSubredditFilter ? topicSubreddits : '', limit: topicLimit,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Search failed');

      setSearchResults(result.posts);
      setProgress(100);
      setStatusMessage(`Found ${result.afterFiltering} high-engagement posts`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearchingTopic(false);
    }
  };

  const searchSubreddit = async () => {
    if (!subredditName.trim()) { setError('Please enter a subreddit name'); return; }

    clearResults();
    setSearchingSubreddit(true);
    setStatusMessage('Getting top posts...');
    setProgress(50);

    try {
      const response = await fetch('/api/reddit-research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subreddit', subreddit: subredditName.replace(/^r\//, ''),
          timeRange: subredditTimeRange, limit: subredditLimit,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Search failed');

      setSearchResults(result.posts);
      setProgress(100);
      setStatusMessage(`Found ${result.afterFiltering} high-engagement posts`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearchingSubreddit(false);
    }
  };

  const togglePostSelection = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) newSelected.delete(postId);
    else newSelected.add(postId);
    setSelectedPosts(newSelected);
  };

  // ─── Combined Analysis (extract + synthesize) ──────────────────────────────

  const runCombinedAnalysis = async () => {
    if (!selectedPersona) { setError('Please select a persona'); return; }

    const selectedUrls = searchResults.filter(p => selectedPosts.has(p.id)).map(p => p.url);
    if (selectedUrls.length === 0) { setError('Please select at least one post'); return; }

    setAnalyzing(true);
    setCombinedResults(null);
    setStatusMessage(`Extracting data from ${selectedUrls.length} posts...`);
    setProgress(10);

    try {
      // Step 1: Extract data from each post
      const allPostsData: any[] = [];
      for (let i = 0; i < selectedUrls.length; i++) {
        setStatusMessage(`Extracting post ${i + 1} of ${selectedUrls.length}...`);
        setProgress(10 + ((i + 1) / selectedUrls.length) * 40);

        const response = await fetch('/api/reddit-research/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: selectedUrls[i] }),
        });
        const result = await response.json();
        if (result.success && result.extractedData) {
          allPostsData.push(result.extractedData);
        }
      }

      if (allPostsData.length === 0) throw new Error('No data could be extracted');

      setExtractedPostsData(allPostsData);
      setStatusMessage('Running AI analysis...');
      setProgress(60);

      // Step 2: Synthesize with persona
      const synthesizeResponse = await fetch('/api/reddit-research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postsData: allPostsData,
          role: selectedPersona,
          goal: researchGoal,
        }),
      });
      const synthesizeResult = await synthesizeResponse.json();
      if (!synthesizeResult.success) throw new Error(synthesizeResult.error || 'Synthesis failed');

      setCombinedResults(synthesizeResult);
      setAnalysisTab('qualitative');
      setProgress(100);
      setStatusMessage('Analysis complete!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // Single URL combined analysis
  const runSinglePostAnalysis = async () => {
    if (!selectedPersona) { setError('Please select a persona'); return; }
    if (extractedPostsData.length === 0) { setError('No extracted data available'); return; }

    setAnalyzing(true);
    setCombinedResults(null);
    setStatusMessage('Running AI analysis...');
    setProgress(50);

    try {
      const response = await fetch('/api/reddit-research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postsData: extractedPostsData,
          role: selectedPersona,
          goal: researchGoal,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Synthesis failed');

      setCombinedResults(result);
      setAnalysisTab('qualitative');
      setProgress(100);
      setStatusMessage('Analysis complete!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // Re-analyze with different persona
  const handleReanalyze = async () => {
    setShowReanalyzeModal(false);
    setSelectedPersona(reanalyzePersona);
    setResearchGoal(reanalyzeGoal);

    setAnalyzing(true);
    setCombinedResults(null);
    setStatusMessage('Re-analyzing with new perspective...');
    setProgress(50);

    try {
      const response = await fetch('/api/reddit-research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postsData: extractedPostsData,
          role: reanalyzePersona,
          goal: reanalyzeGoal,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Re-analysis failed');

      setCombinedResults(result);
      setAnalysisTab('qualitative');
      setProgress(100);
      setStatusMessage('Re-analysis complete!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Re-analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Content Generation ─────────────────────────────────────────────────────

  const openGenerateModal = (typeId: string) => {
    setGenerateType(typeId);
    setGenerateFocus('');
    setGenerateTone('conversational');
    setGenerateLength('medium');
    setShowGenerateModal(true);
  };

  const submitGeneration = async () => {
    if (!generateType) return;

    const savedType = generateType;
    const deliverables = PERSONA_DELIVERABLES[selectedPersona] || [];
    const deliverable = deliverables.find(d => d.id === savedType);

    setShowGenerateModal(false);
    setGenerating(true);
    setStatusMessage(`Generating ${deliverable?.label || 'content'}...`);
    setProgress(50);

    try {
      const structured = combinedResults?.combinedAnalysis?.structured;
      const response = await fetch('/api/reddit-research/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: savedType,
          typeLabel: deliverable?.label || 'Content',
          focus: generateFocus,
          tone: generateTone,
          length: generateLength,
          role: selectedPersona,
          goal: researchGoal,
          insights: structured,
          postsData: extractedPostsData,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Generation failed');

      setGeneratedContents(prev => [...prev, {
        id: Date.now(),
        type: savedType,
        label: deliverable?.label || 'Content',
        icon: deliverable?.icon || '📄',
        content: result.content,
        timestamp: new Date(),
        focus: generateFocus,
        tone: generateTone,
        length: generateLength,
      }]);

      setAnalysisTab('generated');
      setProgress(100);
      setStatusMessage('Content generated!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const deleteGenerated = (id: number) => {
    setGeneratedContents(prev => prev.filter(c => c.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatusMessage('Copied to clipboard!');
    setTimeout(() => setStatusMessage(null), 1500);
  };

  // ─── PDF Export ─────────────────────────────────────────────────────────────

  const exportPDF = () => {
    const structured = combinedResults?.combinedAnalysis?.structured;
    if (!structured) return;

    const content = buildExportContent(structured);
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 500);
    }
  };

  const buildExportContent = (structured: any) => {
    return `<!DOCTYPE html><html><head><title>Reddit Research Insights</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#222}
h1{border-bottom:2px solid #000;padding-bottom:10px}h2{color:#333;margin-top:30px}
.quote{background:#f5f5f5;border-left:3px solid #666;padding:10px 15px;margin:10px 0}
.insight{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:4px}
.tag{display:inline-block;background:#eee;padding:2px 8px;border-radius:3px;font-size:12px;margin:2px}
@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>Reddit Research Insights</h1>
<p><strong>Persona:</strong> ${selectedPersona} | <strong>Goal:</strong> ${researchGoal || 'General research'}</p>
<p><strong>Data:</strong> ${combinedResults?.combinedAnalysis?.postCount || 0} posts, ${combinedResults?.combinedAnalysis?.totalComments || 0} comments</p>

<h2>Executive Summary</h2>
<p>${structured.executiveSummary || 'N/A'}</p>

<h2>Key Insights</h2>
${(structured.keyInsights || []).map((i: any) => `<div class="insight"><strong>${i.title}</strong><br/>${i.description}<br/><span class="tag">${i.sentiment}</span></div>`).join('')}

<h2>For Your Goal</h2>
<ul>${(structured.forYourGoal || []).map((g: string) => `<li>${g}</li>`).join('')}</ul>

<h2>Top Quotes</h2>
${(structured.topQuotes || []).map((q: any) => `<div class="quote"><strong>[${q.type}]</strong> "${q.quote}" <em>— r/${q.subreddit}</em></div>`).join('')}

${structured.quantitativeInsights ? `
<h2>Quantitative Analysis</h2>
<h3>Sentiment Breakdown</h3>
<p>Positive: ${structured.quantitativeInsights.sentimentBreakdown?.positive || 0}% |
Negative: ${structured.quantitativeInsights.sentimentBreakdown?.negative || 0}% |
Neutral: ${structured.quantitativeInsights.sentimentBreakdown?.neutral || 0}%</p>

<h3>Topics Discussed</h3>
${(structured.quantitativeInsights.topicsDiscussed || []).map((t: any) => `<div class="insight"><strong>${t.topic}</strong> (${t.mentions} mentions) — ${t.sentiment}<br/><em>${t.example}</em></div>`).join('')}

<h3>Common Phrases</h3>
<ul>${(structured.quantitativeInsights.commonPhrases || []).map((p: any) => `<li><strong>${p.phrase}</strong> (${p.count}x) — ${p.context}</li>`).join('')}</ul>

<h3>Data Patterns</h3>
<ul>${(structured.quantitativeInsights.dataPatterns || []).map((p: string) => `<li>${p}</li>`).join('')}</ul>
` : ''}

<h2>Confidence</h2>
<p><strong>${structured.confidence?.level || 'N/A'}</strong>: ${structured.confidence?.reason || ''}</p>
</body></html>`;
  };

  // ─── History ────────────────────────────────────────────────────────────────

  const saveResearch = async () => {
    if (!saveName.trim()) { setError('Please enter a name'); return; }
    setSaving(true);
    try {
      const searchQuery = activeTab === 'url' ? redditUrl : activeTab === 'topic' ? topicQuery : subredditName;
      const response = await fetch('/api/reddit-research/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName, searchType: activeTab, searchQuery,
          searchResults, extractedData,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setCurrentResearchId(result.research.id);
      setShowSaveModal(false);
      setSaveName('');
      loadHistory();
      setStatusMessage('Research saved!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSavedResearch = async (id: string) => {
    try {
      setShowHistoryDropdown(false);
      clearResults();
      setStatusMessage('Loading saved research...');
      const response = await fetch(`/api/reddit-research/history/${id}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      const r = result.research;
      setCurrentResearchId(r.id);
      setActiveTab(r.searchType as TabType);
      if (r.searchType === 'url') setRedditUrl(r.searchQuery);
      else if (r.searchType === 'topic') { setTopicQuery(r.searchQuery); }
      else if (r.searchType === 'subreddit') { setSubredditName(r.searchQuery); }
      if (r.searchResults) setSearchResults(r.searchResults);
      if (r.extractedData) { setExtractedData(r.extractedData); setExtractedPostsData([r.extractedData]); setShowPersonaSelector(true); }
      setStatusMessage('Loaded!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteResearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this saved research?')) return;
    try {
      await fetch(`/api/reddit-research/history/${id}`, { method: 'DELETE' });
      loadHistory();
      if (currentResearchId === id) setCurrentResearchId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getEngagementBadge = (tier: string) => {
    const styles: Record<string, string> = {
      viral: 'border-yellow-500/40 text-yellow-400',
      high: 'border-green-500/40 text-green-400',
      medium: 'border-blue-500/40 text-blue-400',
    };
    const labels: Record<string, string> = { viral: '⭐ Viral', high: '🔥 High', medium: '📈 Medium' };
    const cls = styles[tier] || 'border-[var(--tg-border-default)] text-white/50';
    return <span className={`rounded-[999px] border ${cls} px-3 py-0.5 text-[10px] font-mono uppercase tracking-[0.3em]`}>{labels[tier] || 'Low'}</span>;
  };

  const canSave = extractedData || searchResults.length > 0;
  const structured = combinedResults?.combinedAnalysis?.structured;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[var(--tg-bg-primary)] text-[var(--tg-text-primary)]">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '140px 140px' }} />

      <main className="relative mx-auto w-full max-w-6xl px-6 py-10">
        {/* ── Header ── */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[var(--tg-text-secondary)]">Analytics</p>
            <h1 className="text-4xl font-semibold">Reddit Research</h1>
            <p className="text-sm text-[var(--tg-text-secondary)]">Search and analyze high-engagement Reddit discussions with AI</p>
          </div>
          <div className="flex items-center gap-3">
            {/* History */}
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowHistoryDropdown(!showHistoryDropdown)} className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" /> History <ChevronDownIcon className={`w-4 h-4 transition-transform ${showHistoryDropdown ? 'rotate-180' : ''}`} />
              </Button>
              {showHistoryDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-[var(--tg-bg-secondary)] border border-[var(--tg-border-default)] rounded-[4px] shadow-xl overflow-hidden">
                  <div className="p-3 border-b border-[var(--tg-border-default)]">
                    <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">Saved Research</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingHistory ? (
                      <div className="p-4 text-center"><ArrowPathIcon className="w-5 h-5 animate-spin mx-auto text-[var(--tg-accent-primary)]" /></div>
                    ) : savedResearch.length === 0 ? (
                      <div className="p-4 text-center text-sm text-white/50">No saved research yet</div>
                    ) : (
                      savedResearch.map((r) => (
                        <div key={r.id} onClick={() => loadSavedResearch(r.id)} className={`p-3 hover:bg-[var(--tg-bg-tertiary)] cursor-pointer border-b border-[var(--tg-border-default)] last:border-b-0 ${currentResearchId === r.id ? 'bg-[var(--tg-accent-primary)]/10' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white truncate">{r.name}</div>
                              <div className="text-xs text-white/50 truncate mt-0.5">{r.searchQuery}</div>
                              <div className="text-xs text-white/40 mt-1">{r.postsAnalyzed} posts | {formatDate(r.createdAt)}</div>
                            </div>
                            <button onClick={(e) => deleteResearch(r.id, e)} className="p-1 text-white/40 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {canSave && <Button variant="primary" size="sm" onClick={() => setShowSaveModal(true)} className="flex items-center gap-2"><BookmarkIcon className="w-4 h-4" /> Save</Button>}
            <Link href="/apps"><Button variant="secondary" size="sm">← Back</Button></Link>
          </div>
        </div>

        {/* ── Save Modal ── */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)] p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Save Research</h3>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this research..." className="mb-4" autoFocus onKeyPress={(e) => e.key === 'Enter' && saveResearch()} />
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => { setShowSaveModal(false); setSaveName(''); }}>Cancel</Button>
                <Button variant="primary" onClick={saveResearch} disabled={saving || !saveName.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Search Tabs ── */}
        <div className="mb-8 flex gap-2 border-b border-[var(--tg-border-default)]">
          {[
            { id: 'url', label: 'Analyze URL', icon: LinkIcon },
            { id: 'topic', label: 'Topic Search', icon: MagnifyingGlassIcon },
            { id: 'subreddit', label: 'Subreddit Analysis', icon: ChartBarIcon },
          ].map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as TabType); clearResults(); }}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-[0.3em] border-b-2 transition-colors ${activeTab === tab.id ? 'border-[var(--tg-accent-primary)] text-[var(--tg-accent-primary)]' : 'border-transparent text-white/60 hover:text-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── URL Tab ── */}
        {activeTab === 'url' && !combinedResults && (
          <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Analyze Single Reddit Post</h2>
            <div className="flex gap-3">
              <Input value={redditUrl} onChange={(e) => setRedditUrl(e.target.value)} placeholder="Paste Reddit post URL here..." className="flex-1" onKeyPress={(e) => e.key === 'Enter' && analyzeUrl()} />
              <Button variant="primary" onClick={analyzeUrl} disabled={analyzing}>{analyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Extract'}</Button>
            </div>
          </Card>
        )}

        {/* ── Topic Tab ── */}
        {activeTab === 'topic' && !combinedResults && (
          <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Search Reddit by Topic</h2>
            <div className="space-y-4">
              <Input value={topicQuery} onChange={(e) => setTopicQuery(e.target.value)} placeholder="Enter topic or keywords..." onKeyPress={(e) => e.key === 'Enter' && searchByTopic()} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Time Range</label>
                  <select value={topicTimeRange} onChange={(e) => setTopicTimeRange(e.target.value)} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                    <option value="day">Past 24 Hours</option><option value="week">Past Week</option><option value="month">Past Month</option><option value="year">Past Year</option><option value="all">All Time</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Max Results</label>
                  <select value={topicLimit} onChange={(e) => setTopicLimit(Number(e.target.value))} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                    <option value={10}>10</option><option value={15}>15</option><option value={25}>25</option><option value={50}>50</option>
                  </select>
                </div>
              </div>
              <div className="p-4 bg-[var(--tg-bg-tertiary)] rounded-[2px] border border-[var(--tg-border-default)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={topicSubredditFilter} onChange={(e) => setTopicSubredditFilter(e.target.checked)} className="rounded-[2px]" />
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-white/80">Specific subreddits only</span>
                </label>
                {topicSubredditFilter && <Input value={topicSubreddits} onChange={(e) => setTopicSubreddits(e.target.value)} placeholder="e.g., AskReddit, science" className="mt-3" />}
              </div>
              <Button variant="primary" onClick={searchByTopic} disabled={searchingTopic} className="w-full">{searchingTopic ? 'Searching...' : 'Search Posts'}</Button>
            </div>
          </Card>
        )}

        {/* ── Subreddit Tab ── */}
        {activeTab === 'subreddit' && !combinedResults && (
          <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Analyze Subreddit Top Posts</h2>
            <div className="space-y-4">
              <Input value={subredditName} onChange={(e) => setSubredditName(e.target.value)} placeholder="Enter subreddit name (without r/)..." onKeyPress={(e) => e.key === 'Enter' && searchSubreddit()} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Time Range</label>
                  <select value={subredditTimeRange} onChange={(e) => setSubredditTimeRange(e.target.value)} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                    <option value="day">Past 24 Hours</option><option value="week">Past Week</option><option value="month">Past Month</option><option value="year">Past Year</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Max Results</label>
                  <select value={subredditLimit} onChange={(e) => setSubredditLimit(Number(e.target.value))} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                    <option value={10}>10</option><option value={15}>15</option><option value={25}>25</option><option value={50}>50</option>
                  </select>
                </div>
              </div>
              <Button variant="primary" onClick={searchSubreddit} disabled={searchingSubreddit} className="w-full">{searchingSubreddit ? 'Getting Posts...' : 'Get Top Posts'}</Button>
            </div>
          </Card>
        )}

        {/* ── Status / Error ── */}
        {statusMessage && (
          <Card className="mt-6 border border-[var(--tg-accent-primary)]/40 bg-[var(--tg-accent-primary)]/10 p-6 text-center">
            {(analyzing || generating) && <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--tg-accent-primary)] border-t-transparent" />}
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)]">{statusMessage}</p>
            <div className="mt-4 w-full bg-[var(--tg-bg-tertiary)] h-2 rounded-full overflow-hidden">
              <div className="h-full bg-[var(--tg-accent-primary)] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </Card>
        )}
        {error && (
          <Card className="mt-6 border border-red-500/40 bg-red-500/10 p-6 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400 mb-4">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => setError(null)}>Dismiss</Button>
          </Card>
        )}

        {/* ── Persona Selector (after URL extraction) ── */}
        {showPersonaSelector && !combinedResults && (
          <Card className="mt-6 border border-[var(--tg-accent-primary)]/40 bg-[var(--tg-bg-secondary)]/80 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-[var(--tg-accent-primary)]" /> Get AI Insights</h3>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Your Role / Persona</label>
                <select value={selectedPersona} onChange={(e) => setSelectedPersona(e.target.value)} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                  <option value="">Select a persona...</option>
                  {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Input value={researchGoal} onChange={(e) => setResearchGoal(e.target.value)} placeholder="What's your research goal? (e.g., Find pain points for SaaS users)" />
              <Button variant="primary" onClick={runSinglePostAnalysis} disabled={analyzing || !selectedPersona} className="w-full">
                {analyzing ? <><ArrowPathIcon className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><SparklesIcon className="w-4 h-4 mr-2" /> Generate Insights</>}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Search Results ── */}
        {searchResults.length > 0 && !combinedResults && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">{activeTab === 'topic' ? 'Search Results' : `Top Posts from r/${subredditName}`}</h3>
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">{searchResults.length} posts</span>
            </div>
            <div className="space-y-3">
              {searchResults.map((post) => (
                <Card key={post.id} className={`border bg-[var(--tg-bg-secondary)]/80 p-4 cursor-pointer transition-all ${selectedPosts.has(post.id) ? 'border-[var(--tg-accent-primary)] shadow-[0_0_20px_var(--tg-border-glow)]' : 'border-[var(--tg-border-default)]'}`} onClick={() => togglePostSelection(post.id)}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedPosts.has(post.id)} onChange={() => togglePostSelection(post.id)} onClick={(e) => e.stopPropagation()} className="mt-1 rounded-[2px]" />
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-2">{post.title}</div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {getEngagementBadge(post.engagementTier)}
                        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">r/{post.subreddit}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">{formatNumber(post.score)} ⬆️</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">{formatNumber(post.num_comments)} 💬</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">{post.ageText}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Selected posts bar with persona */}
            {selectedPosts.size > 0 && (
              <Card className="border border-[var(--tg-accent-primary)] bg-[var(--tg-accent-primary)]/10 p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)]">{selectedPosts.size} post{selectedPosts.size !== 1 ? 's' : ''} selected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={selectedPersona} onChange={(e) => setSelectedPersona(e.target.value)} className="px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                      <option value="">Select persona...</option>
                      {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Input value={researchGoal} onChange={(e) => setResearchGoal(e.target.value)} placeholder="Research goal..." />
                  </div>
                  <Button variant="primary" onClick={runCombinedAnalysis} disabled={analyzing || !selectedPersona} className="w-full">
                    {analyzing ? <><ArrowPathIcon className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><SparklesIcon className="w-4 h-4 mr-2" /> Analyze with AI</>}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Combined Results ── */}
        {combinedResults && structured && (
          <div className="mt-8 space-y-6">
            {/* Analysis header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">AI Insights</h2>
                <p className="text-sm text-white/50 mt-1">{selectedPersona} | {combinedResults.combinedAnalysis?.postCount} posts, {combinedResults.combinedAnalysis?.totalComments} comments</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setReanalyzePersona(selectedPersona); setReanalyzeGoal(researchGoal); setShowReanalyzeModal(true); }}>
                  <ArrowPathIcon className="w-4 h-4 mr-1" /> Re-analyze
                </Button>
                <Button variant="secondary" size="sm" onClick={exportPDF}>
                  <DocumentArrowDownIcon className="w-4 h-4 mr-1" /> Export PDF
                </Button>
                <Button variant="secondary" size="sm" onClick={clearResults}>New Search</Button>
              </div>
            </div>

            {/* Analysis tabs */}
            <div className="flex gap-2 border-b border-[var(--tg-border-default)]">
              {[
                { id: 'qualitative', label: 'Qualitative Analysis' },
                { id: 'data', label: 'Data Analysis' },
                ...(generatedContents.length > 0 ? [{ id: 'generated', label: `Generated (${generatedContents.length})` }] : []),
              ].map((tab) => (
                <button key={tab.id} onClick={() => setAnalysisTab(tab.id as AnalysisTab)}
                  className={`px-4 py-3 font-mono text-xs uppercase tracking-[0.3em] border-b-2 transition-colors ${analysisTab === tab.id ? 'border-[var(--tg-accent-primary)] text-[var(--tg-accent-primary)]' : 'border-transparent text-white/60 hover:text-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Qualitative Tab ── */}
            {analysisTab === 'qualitative' && (
              <div className="space-y-6">
                {/* Executive Summary */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-3">Executive Summary</h3>
                  <p className="text-white/90 leading-relaxed">{structured.executiveSummary}</p>
                </Card>

                {/* Key Insights */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Key Insights</h3>
                  <div className="space-y-3">
                    {(structured.keyInsights || []).map((insight: any, i: number) => (
                      <div key={i} className="p-4 bg-[var(--tg-bg-tertiary)] rounded-[2px] border border-[var(--tg-border-default)]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{insight.title}</span>
                          <span className={`rounded-[999px] border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.2em] ${insight.sentiment === 'positive' ? 'border-green-500/40 text-green-400' : insight.sentiment === 'negative' ? 'border-red-500/40 text-red-400' : 'border-blue-500/40 text-blue-400'}`}>{insight.sentiment}</span>
                        </div>
                        <p className="text-white/70 text-sm">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* For Your Goal */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-3">For Your Goal</h3>
                  <ul className="space-y-2">
                    {(structured.forYourGoal || []).map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-white/80">
                        <span className="text-[var(--tg-accent-primary)] mt-1">→</span> {item}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Top Quotes */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Top Quotes</h3>
                  <div className="space-y-3">
                    {(structured.topQuotes || []).map((q: any, i: number) => (
                      <div key={i} className="p-4 border-l-2 border-[var(--tg-accent-primary)] bg-[var(--tg-bg-tertiary)]">
                        <span className={`inline-block rounded-[999px] border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.2em] mb-2 ${q.type === 'WARNING' ? 'border-yellow-500/40 text-yellow-400' : q.type === 'COMPLAINT' ? 'border-red-500/40 text-red-400' : 'border-green-500/40 text-green-400'}`}>{q.type}</span>
                        <p className="text-white/80 italic">&ldquo;{q.quote}&rdquo;</p>
                        <p className="text-white/40 text-xs mt-1">— r/{q.subreddit}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Confidence */}
                {structured.confidence && (
                  <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-4">
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs uppercase tracking-[0.3em] px-3 py-1 rounded-[999px] border ${structured.confidence.level === 'high' ? 'border-green-500/40 text-green-400' : structured.confidence.level === 'medium' ? 'border-yellow-500/40 text-yellow-400' : 'border-red-500/40 text-red-400'}`}>{structured.confidence.level} confidence</span>
                      <span className="text-white/60 text-sm">{structured.confidence.reason}</span>
                    </div>
                  </Card>
                )}

                {/* Create Content Section */}
                {PERSONA_DELIVERABLES[selectedPersona] && (
                  <Card className="border border-[var(--tg-accent-primary)]/30 bg-[var(--tg-bg-secondary)]/80 p-6">
                    <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Create Content</h3>
                    <p className="text-white/60 text-sm mb-4">Generate deliverables using your insights and real Reddit quotes.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {PERSONA_DELIVERABLES[selectedPersona].map((d) => (
                        <button key={d.id} onClick={() => openGenerateModal(d.id)} className="p-4 text-left bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] hover:border-[var(--tg-accent-primary)] transition-colors">
                          <span className="text-lg mr-2">{d.icon}</span>
                          <span className="font-semibold text-white">{d.label}</span>
                          <p className="text-white/50 text-xs mt-1">{d.description}</p>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── Data Analysis Tab ── */}
            {analysisTab === 'data' && structured.quantitativeInsights && (
              <div className="space-y-6">
                {/* Sentiment */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Sentiment Breakdown</h3>
                  <div className="flex gap-4 mb-4">
                    {Object.entries(structured.quantitativeInsights.sentimentBreakdown || {}).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex-1 text-center p-3 bg-[var(--tg-bg-tertiary)] rounded-[2px]">
                        <div className={`text-2xl font-semibold ${key === 'positive' ? 'text-green-400' : key === 'negative' ? 'text-red-400' : 'text-blue-400'}`}>{val}%</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60 mt-1">{key}</div>
                      </div>
                    ))}
                  </div>
                  <div className="w-full h-3 bg-[var(--tg-bg-tertiary)] rounded-full overflow-hidden flex">
                    <div className="bg-green-500 h-full" style={{ width: `${structured.quantitativeInsights.sentimentBreakdown?.positive || 0}%` }} />
                    <div className="bg-red-500 h-full" style={{ width: `${structured.quantitativeInsights.sentimentBreakdown?.negative || 0}%` }} />
                    <div className="bg-blue-500 h-full" style={{ width: `${structured.quantitativeInsights.sentimentBreakdown?.neutral || 0}%` }} />
                  </div>
                </Card>

                {/* Topics */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Topics Discussed</h3>
                  <div className="space-y-3">
                    {(structured.quantitativeInsights.topicsDiscussed || []).map((t: any, i: number) => (
                      <div key={i} className="p-3 bg-[var(--tg-bg-tertiary)] rounded-[2px] border border-[var(--tg-border-default)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white">{t.topic}</span>
                          <span className="font-mono text-xs text-white/50">{t.mentions} mentions</span>
                        </div>
                        <p className="text-white/60 text-sm">{t.example}</p>
                        <span className={`inline-block mt-1 rounded-[999px] border px-2 py-0.5 text-[10px] font-mono ${t.sentiment === 'positive' ? 'border-green-500/40 text-green-400' : t.sentiment === 'negative' ? 'border-red-500/40 text-red-400' : 'border-yellow-500/40 text-yellow-400'}`}>{t.sentiment}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Common Phrases */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-4">Common Phrases</h3>
                  <div className="space-y-2">
                    {(structured.quantitativeInsights.commonPhrases || []).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[var(--tg-bg-tertiary)] rounded-[2px]">
                        <div><span className="font-semibold text-white">{p.phrase}</span><span className="text-white/50 text-sm ml-2">— {p.context}</span></div>
                        <span className="font-mono text-xs text-[var(--tg-accent-primary)]">{p.count}x</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Patterns */}
                <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--tg-accent-primary)] mb-3">Data Patterns</h3>
                  <ul className="space-y-2">
                    {(structured.quantitativeInsights.dataPatterns || []).map((p: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-white/80"><span className="text-[var(--tg-accent-primary)]">→</span> {p}</li>
                    ))}
                  </ul>
                  {structured.quantitativeInsights.engagementCorrelation && (
                    <div className="mt-4 p-3 border border-[var(--tg-border-default)] bg-[var(--tg-bg-tertiary)] rounded-[2px]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Engagement Correlation</span>
                      <p className="text-white/80 mt-1">{structured.quantitativeInsights.engagementCorrelation}</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── Generated Tab ── */}
            {analysisTab === 'generated' && (
              <div className="space-y-6">
                {generatedContents.length === 0 ? (
                  <Card className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-8 text-center">
                    <p className="text-white/50">No generated content yet. Use the Create Content buttons in the Qualitative tab.</p>
                  </Card>
                ) : (
                  generatedContents.map((gc) => (
                    <Card key={gc.id} className="border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)]/80 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{gc.icon}</span>
                          <span className="font-semibold text-white">{gc.label}</span>
                          {gc.focus && <span className="text-white/40 text-sm">| {gc.focus}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => copyToClipboard(gc.content)}><ClipboardDocumentIcon className="w-4 h-4" /></Button>
                          <Button variant="secondary" size="sm" onClick={() => deleteGenerated(gc.id)}><TrashIcon className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="prose prose-invert max-w-none text-white/80 whitespace-pre-wrap text-sm leading-relaxed bg-[var(--tg-bg-tertiary)] p-4 rounded-[2px] border border-[var(--tg-border-default)] max-h-96 overflow-y-auto">
                        {gc.content}
                      </div>
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                        {gc.tone} | {gc.length} | {new Date(gc.timestamp).toLocaleTimeString()}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Generate Modal ── */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)] p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Generate Content</h3>
                <button onClick={() => setShowGenerateModal(false)} className="text-white/40 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Focus (optional)</label>
                  <Input value={generateFocus} onChange={(e) => setGenerateFocus(e.target.value)} placeholder="Specific angle or topic to focus on..." />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Tone</label>
                  <div className="flex gap-3">
                    {['professional', 'conversational', 'casual'].map(t => (
                      <button key={t} onClick={() => setGenerateTone(t)} className={`flex-1 py-2 rounded-[2px] font-mono text-xs uppercase tracking-[0.2em] border transition-colors ${generateTone === t ? 'border-[var(--tg-accent-primary)] text-[var(--tg-accent-primary)] bg-[var(--tg-accent-primary)]/10' : 'border-[var(--tg-border-default)] text-white/60 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Length</label>
                  <div className="flex gap-3">
                    {['short', 'medium', 'long'].map(l => (
                      <button key={l} onClick={() => setGenerateLength(l)} className={`flex-1 py-2 rounded-[2px] font-mono text-xs uppercase tracking-[0.2em] border transition-colors ${generateLength === l ? 'border-[var(--tg-accent-primary)] text-[var(--tg-accent-primary)] bg-[var(--tg-accent-primary)]/10' : 'border-[var(--tg-border-default)] text-white/60 hover:text-white'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <Button variant="primary" onClick={submitGeneration} className="w-full">Generate</Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Re-analyze Modal ── */}
        {showReanalyzeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md border border-[var(--tg-border-default)] bg-[var(--tg-bg-secondary)] p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Re-analyze with New Perspective</h3>
              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-[0.3em] text-white/70 mb-2">Persona</label>
                  <select value={reanalyzePersona} onChange={(e) => setReanalyzePersona(e.target.value)} className="w-full px-3 py-2 bg-[var(--tg-bg-tertiary)] border border-[var(--tg-border-default)] rounded-[2px] text-white font-mono text-sm">
                    {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <Input value={reanalyzeGoal} onChange={(e) => setReanalyzeGoal(e.target.value)} placeholder="New research goal..." />
                <div className="flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => setShowReanalyzeModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleReanalyze}>Re-analyze</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Click outside to close dropdowns */}
        {showHistoryDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowHistoryDropdown(false)} />}
      </main>
    </div>
  );
}
