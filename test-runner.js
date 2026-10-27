/* Resume.AI Deterministic Scorer Test Suite - Phase 4 */
const { normalizeText, extractKeywords, analyzeResumeLocally } = require("./analyzer.js");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
};

console.log("🚀 Starting Resume.AI Scorer Test Suite...\n");

// 1. Text Normalization Test
console.log("Testing text normalization...");
assert(normalizeText("  ReactJS  C++  .NET  ") === "reactjs c++ .net", "Text normalization spaces/lowercase failed");
console.log("✓ Normalization checks passed");

// 2. Keyword Extraction Tests
console.log("Testing keyword extraction...");
const jdText = "Looking for a Software Engineer. Core skills: C++, C#, .NET, Node.js, and Cloud Deployment.";
const keywords = extractKeywords(jdText);
assert(keywords.includes("c++"), "Punctuation token C++ failed extraction");
assert(keywords.includes("c#"), "Punctuation token C# failed extraction");
assert(keywords.includes(".net"), "Punctuation token .NET failed extraction");
assert(keywords.includes("node.js"), "Punctuation token Node.js failed extraction");
assert(keywords.includes("cloud deployment"), "Multiword phrase failed extraction");
console.log("✓ Keyword extraction checks passed");

// 3. Score identical inputs consistency
console.log("Testing score consistency (identical inputs)...");
const baseResume = {
  contact: { fullName: "Test User", headline: "Engineer", email: "test@example.com", phone: "12345", location: "US", linkedin: "", portfolio: "" },
  summary: "Summary description details.",
  experience: [
    {
      id: "exp-1", company: "Company A", title: "Developer", startDate: "2020", endDate: "2022", location: "US", current: false,
      bullets: [{ id: "b-1", text: "Successfully delivered React project on a 4-person team reducing load time by 30%." }]
    }
  ],
  education: [{ id: "edu-1", school: "University", degree: "BS", field: "CS", gradDate: "2019" }],
  skills: { technical: ["React", "JavaScript"], tools: ["Git"] }
};
const baseVault = [];
const baseJd = "Looking for a developer with React, JavaScript, Git skills.";

const res1 = analyzeResumeLocally({ resume: baseResume, vault: baseVault, jobDescription: baseJd });
const res2 = analyzeResumeLocally({ resume: baseResume, vault: baseVault, jobDescription: baseJd });
assert(res1.total === res2.total, "Identical inputs did not produce identical scores");
console.log(`✓ Score consistency verified. Score: ${res1.total}/100`);

// 4. Repeated keywords density (Stuffing Safeguard)
console.log("Testing keyword stuffing density safeguard...");
const stuffedResume = {
  ...baseResume,
  summary: "React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React React"
};
const stuffingRes = analyzeResumeLocally({ resume: stuffedResume, vault: baseVault, jobDescription: "React development" });
const stuffingWarning = stuffingRes.categories.keywordCoverage.findings.find(f => f.title.includes("density"));
assert(stuffingWarning !== undefined, "Keyword stuffing high density not detected");
console.log("✓ Keyword stuffing safeguard warning verified");

// 5. Safe Link Protocols validation
console.log("Testing unsafe protocols and links validation...");
const unsafeResume = {
  ...baseResume,
  contact: {
    ...baseResume.contact,
    linkedin: "javascript:alert('xss')",
    portfolio: "data:text/html,xss"
  }
};
const unsafeRes = analyzeResumeLocally({ resume: unsafeResume, vault: baseVault, jobDescription: baseJd });
assert(unsafeRes.categories.contactAndFormatting.score < 10, "Unsafe protocol not penalized");
const linkedinErr = unsafeRes.categories.contactAndFormatting.findings.find(f => f.title.includes("LinkedIn"));
const portfolioErr = unsafeRes.categories.contactAndFormatting.findings.find(f => f.title.includes("Portfolio"));
assert(linkedinErr && linkedinErr.explanation.includes("unsafe"), "Unsafe LinkedIn protocol warning missing");
assert(portfolioErr && portfolioErr.explanation.includes("unsafe"), "Unsafe Portfolio protocol warning missing");
console.log("✓ Unsafe link protocols rejected successfully");

// 6. Bullet Quality analysis
console.log("Testing bullet quality scanner (Metrics, Weak phrases, and Strong non-metrics)...");
const weakBulletsResume = {
  ...baseResume,
  experience: [
    {
      id: "exp-1", company: "Company A", title: "Developer", startDate: "2020", endDate: "2022", location: "US", current: false,
      bullets: [
        { id: "b-weak", text: "Helped write some code and managed things." } // Weak verb "helped", vague "things", lacks metric
      ]
    }
  ]
};
const weakRes = analyzeResumeLocally({ resume: weakBulletsResume, vault: baseVault, jobDescription: baseJd });
assert(weakRes.categories.bulletQuality.score < 20, "Weak bullet did not reduce quality score");
const bulletIssue = weakRes.weakBullets.find(wb => wb.bulletId === "b-weak");
assert(bulletIssue !== undefined, "Weak bullet issues list not populated");
assert(bulletIssue.issues.includes("Begins with a weak/passive phrase"), "Weak verb warning missing");
assert(bulletIssue.issues.includes("Lacks measurable metrics or business outcomes"), "Quantifiable metric warning missing");

// Test strong bullet with no numbers
const strongNoMetricResume = {
  ...baseResume,
  experience: [
    {
      id: "exp-1", company: "Company A", title: "Developer", startDate: "2020", endDate: "2022", location: "US", current: false,
      bullets: [
        { id: "b-strong", text: "Led the migration of a legacy application to a modular React architecture, improving maintainability and release reliability." }
      ]
    }
  ]
};
const strongRes = analyzeResumeLocally({ resume: strongNoMetricResume, vault: baseVault, jobDescription: baseJd });
assert(strongRes.categories.bulletQuality.score === 18, `Strong non-metric bullet should score 18, got: ${strongRes.categories.bulletQuality.score}`);
const strongIssue = strongRes.weakBullets.find(wb => wb.bulletId === "b-strong");
assert(strongIssue !== undefined, "Strong bullet should still be flagged with missing metric warning");
assert(strongIssue.issues.length === 1 && strongIssue.issues[0] === "Lacks measurable metrics or business outcomes", "Strong bullet should only have the missing metric issue");
console.log("✓ Bullet Quality weak verb, metric checker, and strong non-metric bullet verified");

// 7. Certification Vault Matching
console.log("Testing vault certification requirements alignment matching...");
const matchingVault = [
  { id: "v-1", name: "AWS Certified Solutions Architect", aliases: ["AWS cert"], keywords: [], type: "certification", active: false }
];
const jdWithCert = "Looking for a cloud engineer with AWS Certified Solutions Architect credential.";
const certMatchRes = analyzeResumeLocally({ resume: baseResume, vault: matchingVault, jobDescription: jdWithCert });
assert(certMatchRes.vaultSuggestions.length > 0, "Vault matching did not generate inclusion suggestion");
const addSug = certMatchRes.vaultSuggestions.find(s => s.vaultItemId === "v-1" && s.action === "add");
assert(addSug !== undefined, "Inclusion recommendation for matching cert missing");
console.log("✓ Certification matching and vault suggestions verified");

console.log("\n🎉 ALL SCORER TESTS PASSED SUCCESSFULLY! 🎉\n");
process.exit(0);
