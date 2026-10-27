/* Resume.AI Local Deterministic Scorer Module - Phase 4 (Corrected Rubric) */

/**
 * Normalizes text to prepare it for keyword matching while preserving critical technology tokens.
 */
function normalizeText(text) {
  if (typeof text !== "string") return "";

  // 1. Lowercase
  let norm = text.toLowerCase();

  // 2. Collapse whitespace
  norm = norm.replace(/\s+/g, " ");

  // 3. Trim
  norm = norm.trim();

  return norm;
}

/**
 * Extracts a list of target technology terms and industry phrases from the Job Description.
 */
function extractKeywords(jdText) {
  if (!jdText || typeof jdText !== "string") return [];

  // Dictionary of known technology tokens and multiword industry phrases
  const industryDictionary = [
    // Languages & Runtimes
    "c#", "c-sharp", ".net", ".net core", "net core", "javascript", "js", "typescript", "ts", "python", "java", "c++", "node.js", "nodejs", "golang",
    // AI & LLM Frameworks / Terms
    "ai", "artificial intelligence", "llm", "azure openai", "semantic kernel", "autogen", "rag", "retrieval-augmented generation", "prompt engineering", "ai agents", "vector search",
    // Frameworks & Libraries
    "react", "react.js", "reactjs", "angular", "vue", "asp.net", "asp.net mvc", "entity framework",
    // Cloud & Azure Ecosystem
    "azure", "microsoft azure", "app services", "azure functions", "logic apps", "key vault", "storage accounts", "azure devops", "aws", "gcp", "docker", "kubernetes", "k8s",
    // Methodologies & Processes
    "agile", "scrum", "kanban", "ci/cd", "continuous integration", "cloud deployment", "sdlc", "code reviews", "technical leadership", "architecture",
    // Database & Data
    "sql", "azure sql", "t-sql", "stored procedures", "cosmos db", "postgres", "mysql", "mongodb", "redis", "rest api", "restful apis", "soap", "web services"
  ];

  const normalizedJd = normalizeText(jdText);
  const foundKeywords = new Set();

  // Match multiword phrases first to prevent sub-string matching issues
  industryDictionary.sort((a, b) => b.length - a.length);

  industryDictionary.forEach(term => {
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let pattern;
    if (/^[a-z0-9]/i.test(term) && /[a-z0-9]$/i.test(term)) {
      pattern = new RegExp(`\\b${escaped}\\b`, "i");
    } else {
      pattern = new RegExp(`(?:\\s|^)${escaped}(?:\\s|$|\\p{P})`, "ui");
    }

    if (pattern.test(normalizedJd)) {
      foundKeywords.add(term);
    }
  });

  return Array.from(foundKeywords).slice(0, 25);
}

/**
 * Calculates keyword matches with alias groups.
 */
function checkKeywordMatches(resumeText, targetKeywords) {
  const normResume = normalizeText(resumeText);
  const matched = [];
  const missing = [];

  const aliasGroups = [
    ["javascript", "js"],
    ["typescript", "ts"],
    ["c#", "c-sharp", "c#.net"],
    [".net", ".net core", "net core", "asp.net"],
    ["azure", "microsoft azure", "azure cloud"],
    ["sql", "azure sql", "t-sql", "sql server"],
    ["ci/cd", "continuous integration", "azure devops", "devops"],
    ["amazon web services", "aws"],
    ["certified scrummaster", "csm", "scrum master", "scrum", "agile"]
  ];

  targetKeywords.forEach(term => {
    const aliases = [term];
    aliasGroups.forEach(group => {
      if (group.includes(term)) {
        group.forEach(g => {
          if (!aliases.includes(g)) aliases.push(g);
        });
      }
    });

    const isMatched = aliases.some(alias => {
      const escaped = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      let pattern;
      if (/^[a-z0-9]/i.test(alias) && /[a-z0-9]$/i.test(alias)) {
        pattern = new RegExp(`\\b${escaped}\\b`, "i");
      } else {
        pattern = new RegExp(`(?:\\s|^)${escaped}(?:\\s|$|\\p{P})`, "ui");
      }
      return pattern.test(normResume);
    });

    if (isMatched) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  });

  return { matched, missing };
}

/**
 * Core Deterministic Resume Analyzer Logic.
 * Corrected rubric alignment: optional links do not penalize unless invalid,
 * skills are measured by relevance, and missing metrics are a suggestion rather than major penalty.
 */
function analyzeResumeLocally({ resume, vault, jobDescription }) {
  const categories = {
    coreSections: { score: 0, maximum: 20, findings: [] },
    keywordCoverage: { score: 0, maximum: 30, findings: [] },
    skillsAndCertifications: { score: 0, maximum: 20, findings: [] },
    bulletQuality: { score: 0, maximum: 20, findings: [] },
    contactAndFormatting: { score: 0, maximum: 10, findings: [] }
  };

  // Build collective resume text
  const activeVaultText = (vault || [])
    .filter(v => v.active && v.name.trim())
    .map(v => `${v.name} ${v.issuer || ""} ${v.aliases ? v.aliases.join(" ") : ""}`)
    .join(" ");

  const resumeTextParts = [
    resume.contact.fullName,
    resume.contact.headline,
    resume.summary,
    ...resume.experience.map(e => `${e.company} ${e.title} ${e.bullets.map(b => b.text).join(" ")}`),
    ...resume.education.map(edu => `${edu.school} ${edu.degree} ${edu.field}`),
    ...(resume.skills.technical || []),
    ...(resume.skills.tools || []),
    activeVaultText
  ];

  const fullResumeText = resumeTextParts.join(" ");

  // 1. Core Sections Score (Max 20)
  const hasName = resume.contact.fullName.trim().length > 0;
  const hasHeadline = resume.contact.headline.trim().length > 0;
  const hasSummary = resume.summary.trim().length > 0;
  const hasExperience = resume.experience.length > 0 && resume.experience.some(e => e.company.trim() || e.title.trim());
  const hasBullets = resume.experience.flatMap(e => e.bullets).some(b => b.text.trim().length > 0);
  const hasEducation = resume.education.length > 0 && resume.education.some(edu => edu.school.trim());
  const hasSkills = (resume.skills.technical || []).length > 0 || (resume.skills.tools || []).length > 0;

  let coreScore = 0;
  const coreFindings = [];

  if (hasName) {
    coreScore += 3;
    coreFindings.push({ type: "success", title: "Name details matched", explanation: "Candidate name header is present on the resume sheet.", pointsAffected: 3 });
  } else {
    coreFindings.push({ type: "error", title: "Missing Name", explanation: "Add your full name header to establish your application identity.", pointsAffected: 3 });
  }

  if (hasHeadline) {
    coreScore += 3;
    coreFindings.push({ type: "success", title: "Headline matched", explanation: "Professional title or target role headline is clearly identified.", pointsAffected: 3 });
  } else {
    coreFindings.push({ type: "warning", title: "Missing Headline", explanation: "Add a headline reflecting your target role.", pointsAffected: 3 });
  }

  if (hasSummary) {
    coreScore += 3;
    coreFindings.push({ type: "success", title: "Summary matched", explanation: "A brief professional profile summary block was successfully verified.", pointsAffected: 3 });
  } else {
    coreFindings.push({ type: "warning", title: "Missing Summary", explanation: "A focused summary paragraph helps surface your target role and core qualifications.", pointsAffected: 3 });
  }

  if (hasExperience && hasBullets) {
    coreScore += 4;
    coreFindings.push({ type: "success", title: "Experience items matched", explanation: "Employment history cards containing description bullet points are present.", pointsAffected: 4 });
  } else {
    coreFindings.push({ type: "error", title: "Missing Career History", explanation: "Add at least one work experience history block with concrete bullet details.", pointsAffected: 4 });
  }

  if (hasEducation) {
    coreScore += 4;
    coreFindings.push({ type: "success", title: "Education history matched", explanation: "An academic or training history section is present.", pointsAffected: 4 });
  } else {
    coreFindings.push({ type: "warning", title: "Missing Education", explanation: "Establish credentials by adding your school history or graduation details.", pointsAffected: 4 });
  }

  if (hasSkills) {
    coreScore += 3;
    coreFindings.push({ type: "success", title: "Skills block matched", explanation: "Targeted skill lists (technical or tools) are present.", pointsAffected: 3 });
  } else {
    coreFindings.push({ type: "warning", title: "Missing Skills list", explanation: "Add technical skills and tools lists to aid parsing systems.", pointsAffected: 3 });
  }

  categories.coreSections = { score: coreScore, maximum: 20, findings: coreFindings };


  // 2. Keyword Coverage Score (Max 30) - Weighted Keyword Coverage
  const targetKeywords = extractKeywords(jobDescription);
  const { matched: matchedKws, missing: missingKws } = checkKeywordMatches(fullResumeText, targetKeywords);

  let keywordScore = 0;
  const keywordFindings = [];

  if (targetKeywords.length > 0) {
    // Calculate total weights (multiword phrases get weight of 2, single keywords get 1)
    let totalTargetWeight = 0;
    let matchedWeight = 0;

    targetKeywords.forEach(term => {
      const termWeight = term.includes(" ") ? 2 : 1;
      totalTargetWeight += termWeight;
      if (matchedKws.includes(term)) {
        matchedWeight += termWeight;
      }
    });

    keywordScore = Math.round((matchedWeight / totalTargetWeight) * 30);
    keywordFindings.push({
      type: keywordScore > 20 ? "success" : "warning",
      title: `Keyword coverage: ${matchedKws.length} of ${targetKeywords.length} matched`,
      explanation: `Weighted Score: ${keywordScore}/30. Matched: ${matchedKws.join(", ")}. Missing: ${missingKws.join(", ")}.`,
      pointsAffected: 30 - keywordScore
    });

    // Keyword Stuffing safeguard checking density
    const totalWords = fullResumeText.split(/\s+/).filter(Boolean).length;
    let keywordCountInResume = 0;
    targetKeywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "gi");
      const matches = fullResumeText.match(regex);
      if (matches) keywordCountInResume += matches.length;
    });

    const keywordDensity = totalWords > 0 ? (keywordCountInResume / totalWords) * 100 : 0;
    if (keywordDensity > 15) {
      keywordFindings.push({
        type: "info",
        title: "High keyword density detected",
        explanation: "Repeating keywords does not improve the compatibility estimate. Use important terms naturally and support them with relevant experience.",
        pointsAffected: 0
      });
    }
  } else {
    keywordFindings.push({
      type: "info",
      title: "No JD keywords target",
      explanation: "Provide a target Job Description to identify technical keywords and calculate alignment.",
      pointsAffected: 30
    });
  }

  categories.keywordCoverage = { score: keywordScore, maximum: 30, findings: keywordFindings };


  // 3. Skills & Certifications Score (Max 20) - Measures Relevance
  let skillsScore = 0;
  const skillsFindings = [];
  const suggestionsList = [];
  const certMatches = [];

  // Match resume technical skills against Job Description keywords
  const techSkills = resume.skills.technical || [];
  const techMatches = techSkills.filter(skill => {
    const term = skill.toLowerCase().trim();
    if (!term) return false;
    return targetKeywords.some(kw => {
      const matchRes = checkKeywordMatches(term, [kw]);
      return matchRes.matched.length > 0 || term.includes(kw) || kw.includes(term);
    });
  });

  if (techMatches.length >= 2) {
    skillsScore += 5;
    skillsFindings.push({ type: "success", title: "Relevant Technical Skills listed", explanation: `Matched ${techMatches.length} technical skill(s) from JD: ${techMatches.join(", ")}.`, pointsAffected: 0 });
  } else if (techMatches.length === 1) {
    skillsScore += 3;
    skillsFindings.push({ type: "warning", title: "Limited Relevant Technical Skills", explanation: `Only matched 1 technical skill: ${techMatches[0]}. Add more skills listed in the Job Description.`, pointsAffected: 2 });
  } else {
    skillsFindings.push({ type: "error", title: "No Relevant Technical Skills matched", explanation: "List technical skills relevant to the target job description details to improve match rating.", pointsAffected: 5 });
  }

  // Match tools list against Job Description keywords
  const toolsList = resume.skills.tools || [];
  const toolsMatches = toolsList.filter(tool => {
    const term = tool.toLowerCase().trim();
    if (!term) return false;
    return targetKeywords.some(kw => {
      const matchRes = checkKeywordMatches(term, [kw]);
      return matchRes.matched.length > 0 || term.includes(kw) || kw.includes(term);
    });
  });

  if (toolsMatches.length >= 2) {
    skillsScore += 5;
    skillsFindings.push({ type: "success", title: "Relevant Software Tools listed", explanation: `Matched ${toolsMatches.length} tools/platforms: ${toolsMatches.join(", ")}.`, pointsAffected: 0 });
  } else if (toolsMatches.length === 1) {
    skillsScore += 3;
    skillsFindings.push({ type: "warning", title: "Limited Relevant Tools", explanation: `Only matched 1 tool: ${toolsMatches[0]}. Add tools/platforms requested by the Job Description.`, pointsAffected: 2 });
  } else {
    skillsFindings.push({ type: "error", title: "No Relevant Tools matched", explanation: "Add software tools, platforms, or utilities matching the Job Description criteria.", pointsAffected: 5 });
  }

  // Vault certification matching against Job Description
  const normJd = normalizeText(jobDescription);
  let matchingCertsScore = 0;

  if (vault && vault.length > 0) {
    vault.forEach(item => {
      const searchTerms = [item.name, ...(item.aliases || []), ...(item.keywords || [])];
      const isPreferred = /prefer|plus/i.test(normJd);
      const matchedTerm = searchTerms.find(term => term.trim() && normJd.includes(term.toLowerCase()));

      if (matchedTerm) {
        certMatches.push({
          vaultItemId: item.id,
          name: item.name,
          matchedTerms: [matchedTerm],
          active: item.active,
          relevance: "high",
          reason: `The Job Description requests credentials matching '${item.name}' (${isPreferred ? "preferred" : "required"}).`
        });

        if (item.active) {
          matchingCertsScore += 5;
        } else {
          suggestionsList.push({
            vaultItemId: item.id,
            action: "add",
            reason: `Include active certification '${item.name}' which matches target Job Description requirements.`,
            matchedJobRequirement: `Matches requested target criteria in Job Description.`
          });
        }
      } else if (item.active && item.type !== "achievement") {
        // Space-saving advice (irrelevant active vault items)
        suggestionsList.push({
          vaultItemId: item.id,
          action: "remove",
          reason: `'${item.name}' does not align with the target job profile. Consider hiding to optimize resume length.`,
          matchedJobRequirement: ""
        });
        skillsFindings.push({
          type: "info",
          title: "Irrelevant certification active",
          explanation: `'${item.name}' is visible but not requested in the JD. Hiding it can save resume space.`,
          pointsAffected: 0
        });
      }
    });

    skillsScore += Math.min(10, matchingCertsScore);
    const activeCertCount = certMatches.filter(c => c.active).length;
    if (activeCertCount > 0) {
      skillsFindings.push({ type: "success", title: "Target certifications active", explanation: `Verified ${activeCertCount} matching certification(s) active on resume.`, pointsAffected: 0 });
    }
  }

  categories.skillsAndCertifications = { 
    score: Math.min(20, skillsScore), 
    maximum: 20, 
    findings: skillsFindings 
  };


  // 4. Experience Bullet Quality Score (Max 20) - Strong beginning, outcome, length
  let bulletScore = 20;
  const bulletFindings = [];
  const weakBullets = [];
  const allBullets = resume.experience.flatMap(e => e.bullets).filter(b => b.text.trim());

  const weakVerbs = ["helped", "assisted", "responsible for", "worked on", "handled", "managed", "participated in", "tasked with", "duties included"];
  const vaguePhrases = ["various tasks", "many projects", "things", "stuff", "etc."];

  let weakCount = 0;
  let firstPersonCount = 0;
  let shortCount = 0;
  let longCount = 0;
  let hasAtLeastOneMetric = false;

  allBullets.forEach(b => {
    const textLower = b.text.toLowerCase();
    const issues = [];

    // Check weak verbs/phrase beginnings
    const startsWeak = weakVerbs.some(verb => textLower.startsWith(verb) || textLower.includes(` ${verb}`));
    if (startsWeak) {
      issues.push("Begins with a weak/passive phrase");
      weakCount++;
    }

    // Check first person pronouns
    const hasFirstPerson = /\b(i|me|my|we|our)\b/i.test(b.text);
    if (hasFirstPerson) {
      issues.push("Uses first-person pronouns ('I', 'my')");
      firstPersonCount++;
    }

    // Check vague terms
    const hasVague = vaguePhrases.some(phrase => textLower.includes(phrase));
    if (hasVague) {
      issues.push("Contains vague terms (e.g. 'various tasks', 'etc.')");
    }

    // Check length boundaries
    if (b.text.length < 35) {
      issues.push("Bullet is too short (under 35 characters)");
      shortCount++;
    } else if (b.text.length > 200) {
      issues.push("Bullet is too long (over 200 characters)");
      longCount++;
    }

    // Check quantifiable metrics
    const hasMetric = /\b\d+(\.\d+)?%?\b/.test(b.text) || /\$\d+/.test(b.text) || /\b(weeks|months|years|users|conversion)\b/i.test(b.text);
    if (hasMetric) {
      hasAtLeastOneMetric = true;
    } else {
      issues.push("Lacks measurable metrics or business outcomes");
    }

    if (issues.length > 0) {
      const expEntry = resume.experience.find(e => e.bullets.includes(b));
      weakBullets.push({
        experienceId: expEntry ? expEntry.id : "",
        bulletId: b.id,
        text: b.text,
        issues: issues,
        hasMetric: hasMetric,
        severity: issues.length > 2 ? "high" : "medium"
      });
    }
  });

  // Deduct points for structural quality issues (metrics are handled separately)
  const weakDeduction = Math.min(8, weakCount * 2);
  const pronounDeduction = Math.min(6, firstPersonCount * 2);
  const lengthDeduction = Math.min(4, (shortCount + longCount) * 1);

  bulletScore = Math.max(0, bulletScore - (weakDeduction + pronounDeduction + lengthDeduction));

  // Metrics are handled as a minor warning/signal rather than a heavy penalty per bullet
  if (allBullets.length > 0 && !hasAtLeastOneMetric) {
    bulletScore = Math.max(0, bulletScore - 2); // Small deduction only if 100% of bullets lack metrics
    bulletFindings.push({
      type: "info",
      title: "No measurable metrics identified",
      explanation: "Tip: Consider adding measurable business outcomes (e.g. percentages, currency) where applicable to highlight your impact.",
      pointsAffected: 2
    });
  }

  if (allBullets.length === 0) {
    bulletScore = 0;
    bulletFindings.push({ type: "error", title: "No bullet details provided", explanation: "Add descriptive bullet details inside experience cards to evaluate bullet quality.", pointsAffected: 20 });
  } else {
    if (weakCount > 0) {
      bulletFindings.push({ type: "warning", title: "Passive verbs detected", explanation: `Found ${weakCount} experience bullet(s) using weak verbs (e.g. 'helped').`, pointsAffected: weakDeduction });
    }
    if (firstPersonCount > 0) {
      bulletFindings.push({ type: "warning", title: "First-person language detected", explanation: `Found ${firstPersonCount} bullets using pronoun descriptors (e.g. 'I', 'my').`, pointsAffected: pronounDeduction });
    }
    if (bulletFindings.length === 0) {
      bulletFindings.push({ type: "success", title: "High-quality bullets", explanation: "All experience bullet points use active descriptions and outcome parameters.", pointsAffected: 0 });
    }
  }

  categories.bulletQuality = { score: bulletScore, maximum: 20, findings: bulletFindings };


  // 5. Contact & Formatting Score (Max 10) - Optional links do not penalize
  let formattingScore = 10;
  const formattingFindings = [];

  const email = resume.contact.email.trim();
  const phone = resume.contact.phone.trim();
  const location = resume.contact.location.trim();
  const linkedin = resume.contact.linkedin.trim();
  const portfolio = resume.contact.portfolio.trim();

  // Rubric: Full Name (2), Email (2), Phone (2), Location (1), Formatting/Length (3)
  if (!hasName) {
    formattingScore -= 2;
    formattingFindings.push({ type: "error", title: "Missing Name details", explanation: "Add your full name header.", pointsAffected: 2 });
  }

  if (email) {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailValid) {
      formattingScore -= 2;
      formattingFindings.push({ type: "error", title: "Invalid Email format", explanation: "Provide a standard email format address.", pointsAffected: 2 });
    }
  } else {
    formattingScore -= 2;
    formattingFindings.push({ type: "error", title: "Email missing", explanation: "Provide an email address so recruiters can contact you.", pointsAffected: 2 });
  }

  if (!phone) {
    formattingScore -= 2;
    formattingFindings.push({ type: "error", title: "Phone number missing", explanation: "Add a telephone contact number.", pointsAffected: 2 });
  }

  if (!location) {
    formattingScore -= 1;
    formattingFindings.push({ type: "warning", title: "Location details missing", explanation: "Add city and state details.", pointsAffected: 1 });
  }

  // Length and general formatting check (3 points)
  const totalLength = fullResumeText.length;
  if (totalLength > 15000) {
    formattingScore -= 2;
    formattingFindings.push({ type: "warning", title: "Excessive resume content length", explanation: "Your resume text length is very high. Consider shortening to stay within 2 pages.", pointsAffected: 2 });
  }

  // Link safety checks (Optional links only generate deductions if invalid or unsafe)
  const linkCheck = (url, name) => {
    if (url) {
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) {
          return { valid: false, issue: "unsafe-protocol" };
        }
      } catch (e) {
        return { valid: false, issue: "invalid-url" };
      }
    }
    return { valid: true };
  };

  if (linkedin) {
    const linkedinRes = linkCheck(linkedin, "LinkedIn");
    if (!linkedinRes.valid) {
      formattingScore = Math.max(0, formattingScore - 2);
      formattingFindings.push({
        type: "error",
        title: "Invalid LinkedIn URL",
        explanation: linkedinRes.issue === "unsafe-protocol" ? "LinkedIn URL uses an unsafe protocol." : "Provide a fully qualified HTTP/HTTPS LinkedIn profile link.",
        pointsAffected: 2
      });
    }
  }

  if (portfolio) {
    const portfolioRes = linkCheck(portfolio, "Portfolio");
    if (!portfolioRes.valid) {
      formattingScore = Math.max(0, formattingScore - 2);
      formattingFindings.push({
        type: "error",
        title: "Invalid Portfolio URL",
        explanation: portfolioRes.issue === "unsafe-protocol" ? "Portfolio URL uses an unsafe protocol." : "Provide a fully qualified HTTP/HTTPS portfolio website link.",
        pointsAffected: 2
      });
    }
  }

  if (formattingFindings.length === 0) {
    formattingFindings.push({ type: "success", title: "Formatting checks verified", explanation: "All contact formats and safe link protocols are valid.", pointsAffected: 0 });
  }

  categories.contactAndFormatting = { score: Math.max(0, formattingScore), maximum: 10, findings: formattingFindings };


  // 6. Aggregate Total & 5-Dimensional Job Fit Matrix (ai-job-search style)
  const total = categories.coreSections.score + 
                categories.keywordCoverage.score + 
                categories.skillsAndCertifications.score + 
                categories.bulletQuality.score + 
                categories.contactAndFormatting.score;

  const skillsFit = Math.round((categories.keywordCoverage.score / 30) * 100);
  const expRelevanceFit = Math.round((categories.coreSections.score / 20) * 100);
  const trajectoryFit = Math.round((categories.bulletQuality.score / 20) * 100);
  const toolPlatformFit = Math.round((categories.skillsAndCertifications.score / 20) * 100);
  const formattingFit = Math.round((categories.contactAndFormatting.score / 10) * 100);

  const fitDimensions = [
    { name: "Technical Skills Alignment", score: skillsFit, desc: `${matchedKws.length} of ${targetKeywords.length} key JD skills matched` },
    { name: "Experience Relevance", score: expRelevanceFit, desc: `${resume.experience.length} career history roles verified` },
    { name: "Bullet Impact & Trajectory", score: trajectoryFit, desc: `${allBullets.length - weakCount} active outcome-driven bullets` },
    { name: "Tools & Platform Coverage", score: toolPlatformFit, desc: `${(resume.skills.tools || []).length} software tools & platforms listed` },
    { name: "ATS Formatting & Structure", score: formattingFit, desc: "Document structure, links, and contact validations" }
  ];

  return {
    total: Math.min(100, Math.max(0, total)),
    maximum: 100,
    label: "ATS Compatibility Estimate",
    categories: categories,
    fitDimensions: fitDimensions,
    matchedKeywords: matchedKws,
    missingKeywords: missingKws,
    weakBullets: weakBullets,
    certificationMatches: certMatches,
    vaultSuggestions: suggestionsList,
    generatedAt: new Date().toISOString()
  };
}

// Export for browser script compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeText,
    extractKeywords,
    analyzeResumeLocally
  };
}
