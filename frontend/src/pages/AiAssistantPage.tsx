/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CourseService } from '../services/courseService';
import { AiService } from '../services/aiService';
import { AI_CONFIG } from '../config/constants';
import {
  AiChatMessage,
  SummaryResult,
  PracticeQuiz,
  AssignmentFeedbackResult,
} from '../types';
import {
  Sparkles,
  MessageSquare,
  FileText,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  BookOpen,
  ArrowRight,
  RotateCcw,
  BarChart2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const renderFormattedMarkdown = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="my-2 space-y-1.5 list-disc list-inside ps-2 text-slate-700 dark:text-slate-300"
        >
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith('---') || line.startsWith('***')) {
      flushList();
      elements.push(
        <hr key={idx} className="my-3 border-slate-200 dark:border-slate-700" />
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={idx}
          className="text-base font-bold text-indigo-700 dark:text-indigo-400 mt-3 mb-1.5"
        >
          {line.replace(/^###\s+/, '')}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={idx}
          className="text-lg font-extrabold text-slate-900 dark:text-white mt-4 mb-2"
        >
          {line.replace(/^##\s+/, '')}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1
          key={idx}
          className="text-xl font-black text-slate-900 dark:text-white mt-4 mb-2"
        >
          {line.replace(/^#\s+/, '')}
        </h1>
      );
    } else if (
      line.startsWith('- ') ||
      line.startsWith('* ') ||
      line.startsWith('• ')
    ) {
      listItems.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      flushList();
      elements.push(
        <p
          key={idx}
          className="my-1.5 leading-relaxed text-slate-800 dark:text-slate-200 text-sm"
        >
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  });

  flushList();
  return elements;
};

export const AiAssistantPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || '';
  const initialTab = (searchParams.get('tab') as any) || 'chat';

  const courses = CourseService.getCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId || (courses.length > 0 ? courses[0].id : '')
  );
  const selectedCourse = CourseService.getCourseById(selectedCourseId);

  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'practice' | 'feedback'>(
    initialTab
  );

  // Sync tab with URL
  const handleTabChange = (tab: 'chat' | 'summary' | 'practice' | 'feedback') => {
    setActiveTab(tab);
    setSearchParams({ courseId: selectedCourseId, tab });
  };

  // 1. SMART CHAT STATE
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `שלום! אני עוזר ה-AI הפדגוגי שלך בקורס ${selectedCourse ? selectedCourse.title : ''}. ניתן לשאול אותי כל שאלה על חומרי ההרצאה, לבקש המחשות ודוגמאות קוד, או לבקש: "הסבר בפשטות רבה יותר עם דוגמה". איך אוכל לעזור לך היום?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 2. SUMMARY GENERATOR STATE
  const [summaryInput, setSummaryInput] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryNotice, setSummaryNotice] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // 3. PRACTICE GENERATOR STATE
  const [practiceTopic, setPracticeTopic] = useState('');
  const [practiceDifficulty, setPracticeDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [practiceCount, setPracticeCount] = useState(AI_CONFIG.DEFAULT_PRACTICE_QUESTIONS_COUNT);
  const [practiceQuiz, setPracticeQuiz] = useState<PracticeQuiz | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [revealedSolutions, setRevealedSolutions] = useState(false);

  // 4. ASSIGNMENT FEEDBACK STATE
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [feedbackSolution, setFeedbackSolution] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<AssignmentFeedbackResult | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState('');

  // Auto scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Handle Chat Submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    setChatNotice('');

    try {
      const res = await AiService.sendChatMessage(
        newHistory,
        selectedCourse ? `${selectedCourse.code}: ${selectedCourse.title}` : undefined
      );

      setChatMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (res.warning) setChatNotice(res.warning);
    } catch {
      setChatNotice(AI_CONFIG.BUSY_FALLBACK_MESSAGE);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Summary Submit
  const handleSummarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryInput.trim() || summaryLoading) return;

    setSummaryLoading(true);
    setSummaryNotice('');
    try {
      const res = await AiService.generateSummary(summaryInput, selectedCourse?.title);
      setSummaryResult(res.result);
      if (res.warning) setSummaryNotice(res.warning);
    } catch {
      setSummaryNotice(AI_CONFIG.BUSY_FALLBACK_MESSAGE);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Handle Practice Quiz Generation
  const handleGeneratePractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPracticeLoading(true);
    setUserAnswers({});
    setRevealedSolutions(false);

    try {
      const res = await AiService.generatePracticeQuiz(
        practiceTopic || (selectedCourse ? selectedCourse.title : 'מדעי המחשב'),
        practiceDifficulty,
        practiceCount
      );
      setPracticeQuiz(res.quiz);
    } catch {
      // safe fallback
    } finally {
      setPracticeLoading(false);
    }
  };

  // Handle Assignment Feedback Submit
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSolution.trim() || feedbackLoading) return;

    setFeedbackLoading(true);
    setFeedbackNotice('');
    try {
      const res = await AiService.evaluateAssignmentDraft(feedbackPrompt, feedbackSolution);
      setFeedbackResult(res.feedback);
      if (res.warning) setFeedbackNotice(res.warning);
    } catch {
      setFeedbackNotice(AI_CONFIG.BUSY_FALLBACK_MESSAGE);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Calculate weak topics from quiz
  const computeWeakTopics = () => {
    if (!practiceQuiz || !revealedSolutions) return [];
    const weak: string[] = [];
    practiceQuiz.questions.forEach((q) => {
      const selected = userAnswers[q.id];
      if (selected !== undefined && selected !== q.correctOptionIndex) {
        if (!weak.includes(q.topic)) weak.push(q.topic);
      }
    });
    return weak;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Course Context Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              עוזר AI חכם (CampuScope AI Assistant)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            מעטפת למידה פדגוגית חכמה: צ׳אט עם שימור הקשר, סיכום חומרים, שאלות תרגול ואבחון חולשות, ומשוב מוקדם
          </p>
        </div>

        {/* Selected Course Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setSearchParams({ courseId: e.target.value, tab: activeTab });
            }}
            className="py-1.5 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Feature Tabs (Scenario 3 Requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => handleTabChange('chat')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'chat'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>1. צ׳אט חכם</span>
        </button>

        <button
          onClick={() => handleTabChange('summary')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'summary'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. מחולל סיכומים</span>
        </button>

        <button
          onClick={() => handleTabChange('practice')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'practice'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>3. מחולל תרגולים</span>
        </button>

        <button
          onClick={() => handleTabChange('feedback')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'feedback'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>4. משוב על מטלות</span>
        </button>
      </div>

      {/* TAB 1: SMART CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[600px]">
          {/* Chat notice if fallback */}
          {chatNotice && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{chatNotice}</span>
            </div>
          )}

          {/* Messages list */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {chatMessages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-2xl ${
                    isAssistant ? 'me-auto' : 'ms-auto flex-row-reverse'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isAssistant
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {isAssistant ? <Sparkles className="w-4 h-4" /> : 'אני'}
                  </div>
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      isAssistant
                        ? 'bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                        : 'bg-indigo-600 text-white shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {chatLoading && (
              <div className="flex gap-3 me-auto max-w-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>עוזר ה-AI מקליד תשובה...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 shrink-0">שאלות נפוצות:</span>
            <button
              type="button"
              onClick={() => setChatInput('הסבר בפשטות רבה יותר עם דוגמה מעשית')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 shrink-0"
            >
              הסבר בפשטות רבה יותר עם דוגמה &larr;
            </button>
            <button
              type="button"
              onClick={() => setChatInput('מהם מקרי הקצה הנפוצים בנושא זה?')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 shrink-0"
            >
              מהם מקרי הקצה הנפוצים?
            </button>
            <button
              type="button"
              onClick={() => setChatInput('איך כותבים הוכחת תת-מבנה אופטימלי?')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 shrink-0"
            >
              איך כותבים הוכחת נכונות?
            </button>
          </div>

          {/* Chat input box */}
          <form
            onSubmit={handleChatSubmit}
            className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="שאל שאלה על חומר הקורס, למשל: הסבר את ההבדל בין עץ AVL לעץ BST רגיל..."
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 shadow-sm"
              aria-label="שלח הודעה"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: SUMMARY GENERATOR */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>הדבק חומר לימוד לסיכום מובנה</span>
            </h3>
            <p className="text-xs text-slate-500">
              הדבק כאן שקף, קטע מסמך או הסבר מההרצאה. מחולל ה-AI יארגן אותו לסיכום תמציתי, נקודות מפתח ומושגי יסוד.
            </p>

            <form onSubmit={handleSummarySubmit} className="space-y-4">
              <textarea
                rows={6}
                required
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                placeholder="הדבק כאן את הטקסט או את חומר הלימוד מתוך הקורס..."
                className="w-full p-4 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setSummaryInput(`עץ חיפוש בינארי (BST) הוא מבנה נתונים מבוסס עץ בינארי שבו לכל צומת יש מפתח. לכל צומת x, כל המפתחות בתת-העץ השמאלי שלו קטנים ממנו, וכל המפתחות בתת-העץ הימני גדולים ממנו. תכונה זו מאפשרת חיפוש, מחיקה והכנסה בזמן O(h) כאשר h הוא גובה העץ. כאשר העץ מאוזן, הגובה הוא O(log n), אך במקרה הגרוע (כאשר המפתחות מוכנסים בסדר ממוין) הגובה מגיע ל-O(n) והעץ הופך לרשימה מקושרת.`)
                  }
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  הדבק דוגמה מתוך הקורס
                </button>

                <button
                  type="submit"
                  disabled={!summaryInput.trim() || summaryLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {summaryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>צור סיכום</span>
                </button>
              </div>
            </form>
          </div>

          {/* Summary Result Area */}
          {summaryNotice && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{summaryNotice}</span>
            </div>
          )}

          {summaryResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    סיכום תמציתי
                  </h4>
                  {summaryResult.summary.length > 250 && (
                    <button
                      type="button"
                      onClick={() => setSummaryExpanded((prev) => !prev)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                    >
                      {summaryExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>הצג פחות</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>קרא עוד</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div
                  className={`text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all ${
                    summaryExpanded
                      ? 'max-h-none overflow-visible'
                      : 'max-h-[380px] overflow-y-auto'
                  }`}
                >
                  {renderFormattedMarkdown(summaryResult.summary)}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  נקודות מפתח מרכזיות
                </h4>
                <ul className="space-y-2">
                  {summaryResult.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  מושגי יסוד והגדרות
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {summaryResult.importantConcepts.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        {item.term}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRACTICE GENERATOR WITH DIAGNOSTIC WEAK TOPICS */}
      {activeTab === 'practice' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>יצירת שאלון תרגול אינטראקטיבי ואבחון חולשות</span>
            </h3>

            <form onSubmit={handleGeneratePractice} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  נושא התרגול
                </label>
                <input
                  type="text"
                  value={practiceTopic}
                  onChange={(e) => setPracticeTopic(e.target.value)}
                  placeholder={selectedCourse ? `למשל: יסודות ${selectedCourse.title}` : 'נושא התרגול...'}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  רמת קושי
                </label>
                <select
                  value={practiceDifficulty}
                  onChange={(e) => setPracticeDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="easy">קל (בסיסי)</option>
                  <option value="medium">בינוני (סטנדרט)</option>
                  <option value="hard">קשה (אתגר)</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={practiceLoading}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {practiceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>חולל {practiceCount} שאלות</span>
                </button>
              </div>
            </form>
          </div>

          {/* Practice Questions List */}
          {practiceQuiz && (
            <div className="space-y-6">
              <div className="space-y-4">
                {practiceQuiz.questions.map((q, qIndex) => {
                  const selected = userAnswers[q.id];
                  const isAnswered = selected !== undefined;
                  const isCorrect = isAnswered && selected === q.correctOptionIndex;

                  return (
                    <div
                      key={q.id}
                      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          שאלה {qIndex + 1} מתוך {practiceQuiz.questions.length} · נושא: {q.topic}
                        </span>
                        {revealedSolutions && isAnswered && (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isCorrect ? 'תשובה נכונה ✓' : 'תשובה שגויה ✗'}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                        {q.question}
                      </h4>

                      {/* Options */}
                      <div className="space-y-2">
                        {q.options.map((opt, optIndex) => {
                          const isOptionSelected = selected === optIndex;
                          let optClass = 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';

                          if (revealedSolutions) {
                            if (optIndex === q.correctOptionIndex) {
                              optClass = 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold';
                            } else if (isOptionSelected) {
                              optClass = 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200';
                            }
                          } else if (isOptionSelected) {
                            optClass = 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold';
                          }

                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => {
                                if (!revealedSolutions) {
                                  setUserAnswers((prev) => ({ ...prev, [q.id]: optIndex }));
                                }
                              }}
                              className={`w-full text-start p-3 rounded-xl border text-xs sm:text-sm transition-all flex items-center gap-3 ${optClass}`}
                            >
                              <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Reveal */}
                      {revealedSolutions && (
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          <strong>הסבר פדגוגי:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reveal Solutions & Diagnostic Report */}
              <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  נענו {Object.keys(userAnswers).length} מתוך {practiceQuiz.questions.length} שאלות
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setRevealedSolutions(true)}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    חשוף פתרונות ודוח אבחון חולשות
                  </button>
                  <button
                    onClick={handleGeneratePractice}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600"
                    title="שאלות חדשות"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weak Topics Diagnostic Card */}
              {revealedSolutions && (
                <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                      דוח אבחון נושאים לחיזוק (Diagnostic Weak Topics):
                    </h4>
                  </div>
                  {computeWeakTopics().length === 0 ? (
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                      כל הכבוד! ענית נכון על כל השאלות. אין נושאים מוגדרים כחלשים בשאלון זה.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        בהתבסס על השאלות שבהן טעית, מומלץ לחזור ולחזק את הנושאים הבאים:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {computeWeakTopics().map((t, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200"
                          >
                            ⚠️ {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ASSIGNMENT FEEDBACK (WITH MANDATORY DISCLAIMER) */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>משוב אוטומטי מוקדם על טיוטת פתרון מטלה</span>
            </h3>

            {/* MANDATORY DISCLAIMER (Scenario 3 Requirement) */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5 font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{AI_CONFIG.DISCLAIMER_TEXT}</span>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  שאלת המטלה / דרישות הפתרון
                </label>
                <textarea
                  rows={3}
                  value={feedbackPrompt}
                  onChange={(e) => setFeedbackPrompt(e.target.value)}
                  placeholder="הדבק כאן את שאלת המטלה..."
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  הפתרון או הקוד שכתבת <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={feedbackSolution}
                  onChange={(e) => setFeedbackSolution(e.target.value)}
                  placeholder="הדבק כאן את פונקציית הקוד או את הפתרון הכתוב שברצונך לבדוק..."
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!feedbackSolution.trim() || feedbackLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {feedbackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>קבל משוב פדגוגי</span>
                </button>
              </div>
            </form>
          </div>

          {/* Feedback Result */}
          {feedbackNotice && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{feedbackNotice}</span>
            </div>
          )}

          {feedbackResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>חוזקות בפתרון</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {feedbackResult.strengths.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Possible Mistakes */}
                <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>טעויות ומקרי קצה</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {feedbackResult.possibleMistakes.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-600">✗</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvement Suggestions */}
                <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>הצעות לשיפור וייעול</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {feedbackResult.improvementSuggestions.map((sug, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-indigo-600">&bull;</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Summary note */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>סיכום הערכה:</strong> {feedbackResult.summaryNote}
              </div>

              {/* Mandatory Disclaimer footer */}
              <div className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-3">
                {AI_CONFIG.DISCLAIMER_TEXT}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
