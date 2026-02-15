/**
 * Email Service
 * Handles sending digest emails via Resend
 */

const { Resend } = require('resend');

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Content Radar <digest@voiceofthecustomer.online>';
const baseUrl = process.env.BASE_URL || 'https://reddit-analysis.vercel.app';

console.log('[Email Service] Initializing...');
console.log('[Email Service] RESEND_API_KEY configured:', !!resendApiKey);
console.log('[Email Service] From email:', fromEmail);
console.log('[Email Service] Base URL:', baseUrl);

const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (!resendApiKey) {
  console.warn('[Email Service] WARNING: RESEND_API_KEY not configured. Emails will be simulated.');
}

/**
 * Send a digest email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subreddit - Subreddit name
 * @param {Object} params.digest - Digest content
 * @param {string} params.unsubscribeToken - Token for unsubscribe link
 * @param {boolean} params.isWelcome - Whether this is a welcome email
 */
async function sendDigestEmail({ to, subreddit, digest, unsubscribeToken, isWelcome = false }) {
  console.log(`[Email Service] sendDigestEmail called for ${to}, subreddit: ${subreddit}, isWelcome: ${isWelcome}`);

  if (!resend) {
    console.log('[Email Service] SIMULATED - No Resend client configured');
    console.log('[Email Service] Would send to:', to);
    console.log('[Email Service] Subject:', isWelcome ? `Welcome to Content Radar! Here's your first digest` : `📰 Your ${digest?.frequency || 'Weekly'} Digest: r/${subreddit}`);
    return { success: true, simulated: true };
  }

  const unsubscribeUrl = `${baseUrl}/content-radar/unsubscribe.html?token=${unsubscribeToken}`;
  const manageUrl = `${baseUrl}/content-radar/manage.html`;

  const subject = isWelcome
    ? `👋 Welcome to Content Radar! Here's your first digest for r/${subreddit}`
    : `📰 Your ${digest?.frequency || 'Weekly'} Digest: r/${subreddit}`;

  console.log(`[Email Service] Generating HTML for digest...`);
  const html = generateDigestHtml(digest, subreddit, unsubscribeUrl, manageUrl, isWelcome);

  try {
    console.log(`[Email Service] Sending via Resend...`);
    console.log(`[Email Service] From: ${fromEmail}`);
    console.log(`[Email Service] To: ${to}`);
    console.log(`[Email Service] Subject: ${subject}`);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    if (error) {
      console.error('[Email Service] Resend API error:', JSON.stringify(error));
      throw new Error(error.message || 'Resend API error');
    }

    console.log(`[Email Service] SUCCESS - Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };

  } catch (error) {
    console.error('[Email Service] FAILED:', error.message);
    console.error('[Email Service] Full error:', error);
    throw error;
  }
}

/**
 * Escape HTML special characters to prevent broken email rendering
 * from user-generated Reddit content (quotes, titles, etc.)
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate HTML for digest email
 * Renders all digest sections: quickHits, coverStory, theDebate, voices,
 * thread, sleeperHit, fromTheTrenches, soWhat, contentIdeas, emerging, metrics
 */
function generateDigestHtml(digest, subreddit, unsubscribeUrl, manageUrl, isWelcome) {
  const issueNumber = digest.issueNumber || 1;
  const periodStart = formatDate(digest.periodStart);
  const periodEnd = formatDate(digest.periodEnd);

  // Helper: truncate selftext for display
  function truncateSelftext(text, maxLen = 500) {
    if (!text) return '';
    const truncated = text.substring(0, maxLen);
    return truncated + (text.length > maxLen ? '...' : '');
  }

  // Helper: get hook text from quickHit (handles both old string format and new object format)
  function getHookText(hit) {
    if (typeof hit === 'string') return hit;
    return hit?.hook || '';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Radar - r/${subreddit}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header .subreddit { font-size: 18px; opacity: 0.9; }
    .header .issue { font-size: 14px; opacity: 0.8; margin-top: 8px; }
    .content { padding: 30px; }
    .section { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 14px; font-weight: 700; color: #667eea; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .card-accent { border-left: 4px solid #667eea; background: linear-gradient(135deg, #667eea08 0%, #9f7aea08 100%); }
    .card-warm { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .card-debate { border-left: 4px solid #ef4444; background: #fef2f2; }
    .card-insight { border-left: 4px solid #10b981; background: #f0fdf4; }
    .post-title { font-size: 17px; font-weight: 600; margin: 0 0 8px 0; color: #1a1a2e; }
    .post-meta { font-size: 13px; color: #666; margin-bottom: 10px; }
    .post-body { font-size: 14px; color: #333; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; }
    .link { color: #667eea; text-decoration: none; font-weight: 500; }
    .link:hover { text-decoration: underline; }
    blockquote { margin: 0 0 8px 0; font-size: 15px; line-height: 1.6; color: #333; }
    .attribution { font-size: 12px; color: #888; margin-top: 4px; }
    .reply { padding: 10px 0 10px 14px; border-left: 2px solid #ddd; margin-bottom: 8px; }
    .reply.nested { margin-left: 14px; }
    .debate-side { padding: 12px; margin-bottom: 8px; border-radius: 6px; }
    .debate-side h4 { margin: 0 0 8px 0; font-size: 14px; }
    .implication { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .implication:last-child { border-bottom: none; }
    .metrics { display: flex; gap: 20px; flex-wrap: wrap; }
    .metric { text-align: center; flex: 1; min-width: 80px; }
    .metric-value { font-size: 24px; font-weight: 700; color: #667eea; }
    .metric-label { font-size: 12px; color: #666; }
    .cta { text-align: center; padding: 20px; background: #f8f9fa; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .footer { padding: 20px 30px; background: #f8f9fa; font-size: 13px; color: #666; text-align: center; }
    .footer a { color: #667eea; text-decoration: none; }
    .tag { display: inline-block; background: #667eea; color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .tag-new { background: #10b981; }
    @media (max-width: 480px) { .metrics { flex-direction: column; align-items: center; } body { padding: 10px; } .content { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📡 CONTENT RADAR</h1>
      <div class="subreddit">r/${subreddit}</div>
      <div class="issue">Issue #${issueNumber} · ${periodStart} – ${periodEnd}</div>
    </div>

    ${isWelcome ? `
    <div style="background: #10b981; color: white; padding: 14px 30px; text-align: center;">
      <p style="margin: 0;">👋 <strong>Welcome!</strong> Here's what you would have received last week.</p>
    </div>
    ` : ''}

    <div class="content">

      ${/* ===== WHAT BLEW UP (Quick Hits) ===== */
      digest.quickHits && digest.quickHits.length > 0 ? `
      <div class="section">
        <div class="section-title">⚡ What blew up</div>
        <div class="card">
          <ul style="margin: 0; padding-left: 18px;">
            ${digest.quickHits.map(hit => {
              const hookText = getHookText(hit);
              const post = (typeof hit === 'object') ? hit.post : null;
              return `<li style="margin-bottom: 8px;">${escapeHtml(hookText)}${post?.url ? ` <a href="${post.url}" class="link" style="font-size: 13px;">→</a>` : ''}</li>`;
            }).join('')}
          </ul>
        </div>
      </div>
      ` : ''}

      ${/* ===== THE BIG ONE (Cover Story — actual post content) ===== */
      digest.coverStory?.post ? `
      <div class="section">
        <div class="section-title">🔥 The big one</div>
        <div class="card card-accent" style="padding: 20px;">
          <div class="post-title">${escapeHtml(digest.coverStory.post.title)}</div>
          <div class="post-meta">
            ${digest.coverStory.post.score || 0} upvotes · ${digest.coverStory.post.numComments || 0} comments · u/${escapeHtml(digest.coverStory.post.author || '')}
          </div>
          ${digest.coverStory.post.selftext ? `
          <div class="post-body">${escapeHtml(truncateSelftext(digest.coverStory.post.selftext, 600))}</div>
          ` : ''}
          <div style="margin-top: 12px;">
            <em style="font-size: 13px; color: #666;">${escapeHtml(digest.coverStory.whyItMatters || '')}</em>
          </div>
          ${digest.coverStory.post.url ? `
          <div style="margin-top: 14px;">
            <a href="${digest.coverStory.post.url}" class="link">Read the full thread →</a>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${/* ===== THE SPLIT (The Debate) ===== */
      digest.theDebate?.topic ? `
      <div class="section">
        <div class="section-title">⚔️ The split</div>
        <div class="card card-debate" style="padding: 20px;">
          <div class="post-title" style="font-size: 16px;">${escapeHtml(digest.theDebate.topic)}</div>
          ${digest.theDebate.post?.url ? `<div class="post-meta"><a href="${digest.theDebate.post.url}" class="link" style="font-size: 12px;">See the thread →</a></div>` : ''}

          ${digest.theDebate.sideA ? `
          <div class="debate-side" style="background: #fee2e2; margin-top: 12px;">
            <h4 style="color: #991b1b;">${escapeHtml(digest.theDebate.sideA.position)}</h4>
            ${(digest.theDebate.sideA.quotes || []).map(q => `
            <blockquote style="font-style: italic; font-size: 14px;">"${escapeHtml(q.text)}"</blockquote>
            <div class="attribution">— ${escapeHtml(q.author)} · ${q.score} ⬆️</div>
            `).join('')}
          </div>
          ` : ''}

          ${digest.theDebate.sideB ? `
          <div class="debate-side" style="background: #dbeafe;">
            <h4 style="color: #1e3a5f;">${escapeHtml(digest.theDebate.sideB.position)}</h4>
            ${(digest.theDebate.sideB.quotes || []).map(q => `
            <blockquote style="font-style: italic; font-size: 14px;">"${escapeHtml(q.text)}"</blockquote>
            <div class="attribution">— ${escapeHtml(q.author)} · ${q.score} ⬆️</div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${/* ===== WORTH QUOTING (Voices — with source links) ===== */
      digest.voicesOfTheWeek && digest.voicesOfTheWeek.length > 0 ? `
      <div class="section">
        <div class="section-title">💬 Worth quoting</div>
        ${digest.voicesOfTheWeek.slice(0, 4).map(voice => `
        <div class="card" style="margin-bottom: 10px;">
          <blockquote>"${escapeHtml(voice.quote)}"</blockquote>
          <div class="attribution">
            — ${escapeHtml(voice.author)} · ${voice.score} ⬆️
            ${voice.context ? ` · <em>${escapeHtml(voice.context)}</em>` : ''}
            ${voice.post?.url ? ` · <a href="${voice.post.url}" class="link" style="font-size: 12px;">thread →</a>` : ''}
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${/* ===== THE THREAD (Thread of the Week) ===== */
      digest.threadOfTheWeek ? `
      <div class="section">
        <div class="section-title">📖 The thread</div>
        <div class="card">
          <div class="post-title" style="font-size: 16px;">${escapeHtml(digest.threadOfTheWeek.title || digest.threadOfTheWeek.post?.title || '')}</div>
          ${digest.threadOfTheWeek.post ? `
          <div class="post-meta">${digest.threadOfTheWeek.post.score || 0} upvotes · ${digest.threadOfTheWeek.post.numComments || 0} comments</div>
          ` : ''}
          ${(digest.threadOfTheWeek.topReplies || []).slice(0, 4).map((reply, i) => `
          <div class="reply ${i > 0 ? 'nested' : ''}">
            <div style="font-size: 14px;">"${escapeHtml(reply.text)}"</div>
            <div class="attribution">— ${escapeHtml(reply.author)} · ${reply.score} ⬆️</div>
          </div>
          `).join('')}
          ${digest.threadOfTheWeek.post?.url ? `
          <div style="margin-top: 12px;"><a href="${digest.threadOfTheWeek.post.url}" class="link">See the full thread →</a></div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${/* ===== UNDER THE RADAR (Sleeper Hit) ===== */
      digest.sleeperHit?.post ? `
      <div class="section">
        <div class="section-title">🔍 Under the radar</div>
        <div class="card card-warm" style="padding: 20px;">
          <div class="post-title" style="font-size: 16px;">${escapeHtml(digest.sleeperHit.post.title)}</div>
          <div class="post-meta">
            ${digest.sleeperHit.post.score || 0} upvotes but ${digest.sleeperHit.post.numComments || 0} comments — the discussion is where the real action is
          </div>
          <div style="font-size: 14px; color: #333; margin-top: 8px;">
            ${escapeHtml(digest.sleeperHit.whyItMatters || '')}
          </div>
          ${digest.sleeperHit.post.url ? `
          <div style="margin-top: 12px;"><a href="${digest.sleeperHit.post.url}" class="link">Check it out →</a></div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${/* ===== REAL TALK (From the Trenches — data from comments) ===== */
      digest.fromTheTrenches && digest.fromTheTrenches.length > 0 ? `
      <div class="section">
        <div class="section-title">📊 Real talk</div>
        <p style="font-size: 13px; color: #666; margin: 0 0 12px 0;">Actual data, tools, and recommendations people shared this week:</p>
        ${digest.fromTheTrenches.slice(0, 5).map(item => `
        <div class="card card-insight" style="padding: 14px; margin-bottom: 8px;">
          <div style="font-size: 14px; color: #333;">${escapeHtml(item.insight)}</div>
          <div class="attribution">
            — ${escapeHtml(item.author || '')}
            ${item.post?.url ? ` · <a href="${item.post.url}" class="link" style="font-size: 12px;">source →</a>` : ''}
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${/* ===== CONNECTING THE DOTS (So What — 2nd order consequences) ===== */
      digest.soWhat?.signal ? `
      <div class="section">
        <div class="section-title">🔮 Connecting the dots</div>
        <div class="card" style="padding: 20px; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-left: 4px solid #8b5cf6;">
          <div style="font-size: 15px; font-weight: 600; color: #5b21b6; margin-bottom: 14px;">
            ${escapeHtml(digest.soWhat.signal)}
          </div>
          ${(digest.soWhat.implications || []).map((impl, i) => `
          <div class="implication" style="padding-left: 12px; ${i === 0 ? 'border-left: 3px solid #a78bfa;' : i === 1 ? 'border-left: 3px solid #7c3aed;' : 'border-left: 3px solid #10b981;'}">
            ${escapeHtml(impl)}
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${/* ===== YOUR MOVE (Content Ideas — with demand signals) ===== */
      digest.contentIdeas && digest.contentIdeas.length > 0 ? `
      <div class="section">
        <div class="section-title">🎯 Your move</div>
        <div class="card card-warm" style="padding: 20px;">
          <ol style="margin: 0; padding-left: 20px;">
            ${digest.contentIdeas.slice(0, 3).map(idea => `
            <li style="margin-bottom: 16px;">
              <strong style="font-size: 15px;">${escapeHtml(idea.title)}</strong>
              ${idea.format ? `<span class="tag" style="margin-left: 6px;">${escapeHtml(idea.format)}</span>` : ''}
              <div style="font-size: 13px; color: #666; margin-top: 4px;">
                ${escapeHtml(idea.demandSignal || idea.rationale || '')}
              </div>
              ${idea.post?.url ? `<div style="margin-top: 4px;"><a href="${idea.post.url}" class="link" style="font-size: 12px;">See the thread that inspired this →</a></div>` : ''}
            </li>
            `).join('')}
          </ol>
        </div>
      </div>
      ` : ''}

      ${/* ===== ON THE RISE (Emerging Topics) ===== */
      digest.emergingTopics && digest.emergingTopics.length > 0 ? `
      <div class="section">
        <div class="section-title">📈 On the rise</div>
        <div class="card">
          ${digest.emergingTopics.slice(0, 5).map(topic => `
          <div style="padding: 6px 0; border-bottom: 1px solid #eee;">
            <strong>${escapeHtml(topic.topic)}</strong>
            ${topic.isNew ? '<span class="tag tag-new" style="margin-left: 6px;">NEW</span>' : ''}
            <span style="font-size: 13px; color: #888;"> · ${topic.mentions} mentions</span>
            ${topic.context ? `<div style="font-size: 13px; color: #666; margin-top: 2px;">${escapeHtml(topic.context)}</div>` : ''}
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${/* ===== BY THE NUMBERS (Metrics) ===== */
      digest.metrics ? `
      <div class="section" style="border-bottom: none;">
        <div class="section-title">📐 By the numbers</div>
        <div class="metrics">
          ${digest.metrics.totalPosts ? `
          <div class="metric">
            <div class="metric-value">${formatNumber(digest.metrics.totalPosts)}</div>
            <div class="metric-label">posts</div>
          </div>
          ` : ''}
          ${digest.metrics.totalComments ? `
          <div class="metric">
            <div class="metric-value">${formatNumber(digest.metrics.totalComments)}</div>
            <div class="metric-label">comments</div>
          </div>
          ` : ''}
          ${digest.metrics.avgScore ? `
          <div class="metric">
            <div class="metric-value">${formatNumber(digest.metrics.avgScore)}</div>
            <div class="metric-label">avg score</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

    </div>

    <div class="cta">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #666;">Want radar on another community?</p>
      <a href="${baseUrl}/content-radar/subscribe.html" class="cta-button">Add Another Subreddit</a>
    </div>

    <div class="footer">
      <p>You're receiving this because you subscribed to Content Radar for r/${subreddit}.</p>
      <div style="margin-top: 12px;">
        <a href="${unsubscribeUrl}">Unsubscribe</a> ·
        <a href="${manageUrl}">Manage Preferences</a>
      </div>
      <p style="margin-top: 16px; font-size: 11px; color: #999;">Content Radar by Voice of the Customer</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format number for display
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Send a simple notification email
 */
async function sendNotificationEmail({ to, subject, message }) {
  if (!resend) {
    console.log('Notification email would be sent to:', to);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>${subject}</h2>
          <p>${message}</p>
        </div>
      `
    });

    if (error) throw new Error(error.message);
    return { success: true, messageId: data.id };

  } catch (error) {
    console.error('Failed to send notification:', error);
    throw error;
  }
}

/**
 * Send a simple welcome email (fast, no AI generation)
 */
async function sendWelcomeEmail({ to, subreddit, frequency, unsubscribeToken }) {
  console.log(`[Email Service] sendWelcomeEmail called for ${to}, subreddit: ${subreddit}`);

  const unsubscribeUrl = `${baseUrl}/content-radar/unsubscribe.html?token=${unsubscribeToken}`;
  const manageUrl = `${baseUrl}/content-radar/manage.html`;

  const nextDigestDay = frequency === 'daily' ? 'tomorrow morning' : 'this Sunday morning';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Your Content Radar is Active!</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">by Voice of the Customer</p>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333;">You're now subscribed to <strong style="color: #667eea;">r/${subreddit}</strong></p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📅 Your first digest arrives:</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">${nextDigestDay}</p>
      </div>

      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Each ${frequency} digest includes:
      </p>
      <ul style="font-size: 14px; color: #666; line-height: 1.8;">
        <li>🔥 Top discussions & trending topics</li>
        <li>💬 Memorable quotes from the community</li>
        <li>💡 Content ideas tailored for creators</li>
        <li>📊 Community pulse & metrics</li>
      </ul>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${baseUrl}/content-radar/subscribe.html" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Add Another Subreddit</a>
      </div>
    </div>
    <div style="padding: 20px; background: #f8f9fa; font-size: 12px; color: #666; text-align: center;">
      <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Unsubscribe</a> ·
      <a href="${manageUrl}" style="color: #667eea; text-decoration: none;">Manage Preferences</a>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #999;">
        Content Radar by Voice of the Customer
      </p>
    </div>
  </div>
</body>
</html>
  `;

  if (!resend) {
    console.log('[Email Service] SIMULATED welcome email to:', to);
    return { success: true, simulated: true };
  }

  try {
    console.log(`[Email Service] Sending welcome email via Resend to ${to}...`);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: `📡 Your Reddit Radar for r/${subreddit} is Active | Voice of the Customer`,
      html: html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    if (error) {
      console.error('[Email Service] Resend error:', JSON.stringify(error));
      throw new Error(error.message || 'Resend API error');
    }

    console.log(`[Email Service] Welcome email SUCCESS - ID: ${data?.id}`);
    return { success: true, messageId: data?.id };

  } catch (error) {
    console.error('[Email Service] Welcome email FAILED:', error.message);
    throw error;
  }
}

module.exports = {
  sendDigestEmail,
  sendNotificationEmail,
  sendWelcomeEmail
};
