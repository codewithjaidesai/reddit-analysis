/**
 * Email Service
 * Handles sending digest emails via Resend
 */

const { Resend } = require('resend');

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Content Radar <digest@contentradar.com>';
const baseUrl = process.env.BASE_URL || 'https://reddit-analysis.vercel.app';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (!resendApiKey) {
  console.warn('Warning: RESEND_API_KEY not configured. Email features will not work.');
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
  if (!resend) {
    console.log('Email would be sent to:', to);
    console.log('Subject:', isWelcome ? `Welcome to Content Radar! Here's your first digest` : `📰 Your ${digest.frequency || 'Weekly'} Digest: r/${subreddit}`);
    return { success: true, simulated: true };
  }

  const unsubscribeUrl = `${baseUrl}/content-radar/unsubscribe.html?token=${unsubscribeToken}`;
  const manageUrl = `${baseUrl}/content-radar/manage.html`;

  const subject = isWelcome
    ? `👋 Welcome to Content Radar! Here's your first digest for r/${subreddit}`
    : `📰 Your ${digest.frequency || 'Weekly'} Digest: r/${subreddit}`;

  const html = generateDigestHtml(digest, subreddit, unsubscribeUrl, manageUrl, isWelcome);

  try {
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
      console.error('Resend error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data.id };

  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Generate HTML for digest email
 */
function generateDigestHtml(digest, subreddit, unsubscribeUrl, manageUrl, isWelcome) {
  const issueNumber = digest.issueNumber || 1;
  const periodStart = formatDate(digest.periodStart);
  const periodEnd = formatDate(digest.periodEnd);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Radar - r/${subreddit}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
    }
    .header .subreddit {
      font-size: 18px;
      opacity: 0.9;
    }
    .header .issue {
      font-size: 14px;
      opacity: 0.8;
      margin-top: 8px;
    }
    ${isWelcome ? `
    .welcome-banner {
      background: #10b981;
      color: white;
      padding: 16px 30px;
      text-align: center;
    }
    .welcome-banner p {
      margin: 0;
    }
    ` : ''}
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #667eea;
      margin-bottom: 12px;
    }
    .quick-hits {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
    }
    .quick-hits ul {
      margin: 0;
      padding-left: 20px;
    }
    .quick-hits li {
      margin-bottom: 8px;
    }
    .cover-story {
      background: linear-gradient(135deg, #667eea10 0%, #9f7aea10 100%);
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid #667eea;
    }
    .cover-story h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }
    .cover-story .meta {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;
    }
    .voice {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .voice blockquote {
      margin: 0 0 8px 0;
      font-style: italic;
      font-size: 15px;
    }
    .voice .attribution {
      font-size: 13px;
      color: #666;
    }
    .thread {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
    }
    .thread-title {
      font-weight: 600;
      margin-bottom: 12px;
    }
    .reply {
      padding: 8px 0 8px 16px;
      border-left: 2px solid #ddd;
      margin-bottom: 8px;
    }
    .reply.nested {
      margin-left: 16px;
    }
    .content-ideas {
      background: #fffbeb;
      border-radius: 8px;
      padding: 16px;
    }
    .content-ideas ol {
      margin: 0;
      padding-left: 20px;
    }
    .content-ideas li {
      margin-bottom: 12px;
    }
    .content-ideas .rationale {
      font-size: 13px;
      color: #666;
    }
    .metrics {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .metric {
      text-align: center;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #667eea;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
    }
    .cta {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #9f7aea 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
    }
    .footer {
      padding: 20px 30px;
      background: #f8f9fa;
      font-size: 13px;
      color: #666;
      text-align: center;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer .links {
      margin-top: 12px;
    }
    @media (max-width: 480px) {
      .metrics {
        flex-direction: column;
        align-items: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📰 CONTENT RADAR</h1>
      <div class="subreddit">r/${subreddit}</div>
      <div class="issue">Issue #${issueNumber} • ${periodStart} - ${periodEnd}</div>
    </div>

    ${isWelcome ? `
    <div class="welcome-banner">
      <p>👋 <strong>Welcome!</strong> Here's what you would have received last week. Your first regular digest arrives soon!</p>
    </div>
    ` : ''}

    <div class="content">
      ${digest.quickHits && digest.quickHits.length > 0 ? `
      <div class="section">
        <div class="section-title">⚡ QUICK HITS</div>
        <div class="quick-hits">
          <ul>
            ${digest.quickHits.map(hit => `<li>${hit}</li>`).join('')}
          </ul>
        </div>
      </div>
      ` : ''}

      ${digest.coverStory ? `
      <div class="section">
        <div class="section-title">🔥 COVER STORY</div>
        <div class="cover-story">
          <h3>"${digest.coverStory.title}"</h3>
          <div class="meta">${digest.coverStory.post?.score || 0} upvotes • ${digest.coverStory.post?.numComments || 0} comments</div>
          <p>${digest.coverStory.summary || ''}</p>
          ${digest.coverStory.post?.url ? `<a href="${digest.coverStory.post.url}" style="color: #667eea;">Read the full thread →</a>` : ''}
        </div>
      </div>
      ` : ''}

      ${digest.voicesOfTheWeek && digest.voicesOfTheWeek.length > 0 ? `
      <div class="section">
        <div class="section-title">💬 VOICES OF THE WEEK</div>
        ${digest.voicesOfTheWeek.slice(0, 3).map(voice => `
        <div class="voice">
          <blockquote>"${voice.quote}"</blockquote>
          <div class="attribution">— ${voice.author} • ${voice.score} ⬆️</div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${digest.threadOfTheWeek ? `
      <div class="section">
        <div class="section-title">📖 THREAD OF THE WEEK</div>
        <div class="thread">
          <div class="thread-title">"${digest.threadOfTheWeek.title}"</div>
          ${(digest.threadOfTheWeek.topReplies || []).slice(0, 4).map((reply, i) => `
          <div class="reply ${i > 0 ? 'nested' : ''}">
            <div>"${reply.text}"</div>
            <div class="attribution" style="font-size: 12px; color: #666; margin-top: 4px;">— ${reply.author} • ${reply.score} ⬆️</div>
          </div>
          `).join('')}
          ${digest.threadOfTheWeek.post?.url ? `<a href="${digest.threadOfTheWeek.post.url}" style="color: #667eea; display: block; margin-top: 12px;">See full thread →</a>` : ''}
        </div>
      </div>
      ` : ''}

      ${digest.contentIdeas && digest.contentIdeas.length > 0 ? `
      <div class="section">
        <div class="section-title">💡 CONTENT IDEAS FOR YOU</div>
        <div class="content-ideas">
          <ol>
            ${digest.contentIdeas.slice(0, 3).map(idea => `
            <li>
              <strong>${idea.title}</strong>
              <div class="rationale">${idea.rationale}</div>
            </li>
            `).join('')}
          </ol>
        </div>
      </div>
      ` : ''}

      ${digest.emergingTopics && digest.emergingTopics.length > 0 ? `
      <div class="section">
        <div class="section-title">🆕 EMERGING THIS WEEK</div>
        <ul>
          ${digest.emergingTopics.slice(0, 5).map(topic => `
          <li><strong>${topic.topic}</strong> (${topic.mentions} mentions) ${topic.isNew ? '🆕' : ''}</li>
          `).join('')}
        </ul>
      </div>
      ` : ''}

      ${digest.metrics ? `
      <div class="section">
        <div class="section-title">📊 THIS WEEK IN NUMBERS</div>
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
          ${digest.metrics.vsLastWeek?.posts ? `
          <div class="metric">
            <div class="metric-value">${digest.metrics.vsLastWeek.posts}</div>
            <div class="metric-label">vs last week</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="cta">
      <p style="margin: 0 0 12px 0;">Did this spark any content ideas?</p>
      <a href="${baseUrl}/content-radar/subscribe.html?subreddit=${subreddit}" class="cta-button">Add Another Subreddit</a>
    </div>

    <div class="footer">
      <p>You're receiving this because you subscribed to Content Radar for r/${subreddit}.</p>
      <div class="links">
        <a href="${unsubscribeUrl}">Unsubscribe</a> •
        <a href="${manageUrl}">Manage Preferences</a>
      </div>
      <p style="margin-top: 16px; font-size: 11px; color: #999;">
        Content Radar<br>
        Part of Voice of the Customer
      </p>
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

module.exports = {
  sendDigestEmail,
  sendNotificationEmail
};
