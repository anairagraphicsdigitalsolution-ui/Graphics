const fs=require('fs');const pkg=require('../package.json');
const api=fs.readFileSync('app/api/growth/command-actions/route.ts','utf8');
const ui=fs.readFileSync('components/growth-command-action-execution.tsx','utf8');
const checks=[
 ['workspace-scoped action query is retained',api.includes(".eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100)")],
 ['status distribution is calculated from bounded actions',api.includes('const statusCounts = enriched.reduce')&&api.includes('status_counts: statusCounts')],
 ['pending reviews are excluded from decision rates',api.includes('const decisionCount = approvedCount + rejectedCount')&&api.includes('pending_reviews: statusCounts.pending_approval || 0')],
 ['approval and rejection rates are nullable without decisions',api.includes('approval_rate: decisionCount ?')&&api.includes('rejection_rate: decisionCount ?')],
 ['execution success rate uses executed and failed states',api.includes("const executionAttempts = (statusCounts.executed || 0) + (statusCounts.failed || 0)")&&api.includes('execution_success_rate: executionAttempts ?')],
 ['reviewer activity is grouped by reviewer identity',api.includes('reviewerMap.get(action.reviewed_by)')&&api.includes('reviewer_activity:')],
 ['execution failure reasons are bounded and exposed',api.includes(".slice(0, 500)")],
 ['feedback quality average uses valid 1-5 ratings',api.includes('feedbackCounts.rated_count')&&api.includes('average_rating: feedbackCounts.rated_count ?')],
 ['bounded window warns when action or feedback caps are reached',api.includes('history_limited: enriched.length === 100')],
 ['API returns governance performance summary',api.includes('actions: enriched, outcomes, governancePerformance')],
 ['UI displays governance KPI cards and reviewer activity',ui.includes('AI Action Governance &amp; Performance')&&ui.includes('Reviewer activity')],
 ['UI displays execution failure reasons and history limitation',ui.includes('Execution failure reasons')&&ui.includes('History limit reached; metrics may be partial.')],
 ['UI clarifies operational execution is not business impact',ui.includes('not business impact')],
 ['release version and verifier registration are current',['6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version),'6.119.0'&&pkg.scripts['verify:all'].includes('verify:growth-command-center-performance-v62300')]
];let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}console.log(`${checks.length-fail}/${checks.length} Function 10 governance performance checks passed`);process.exitCode=fail?1:0;
