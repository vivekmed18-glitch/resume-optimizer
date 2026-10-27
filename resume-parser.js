/**
 * Resume Parser Logic - Phase 8 Resume Upload
 * Contains the local regex section parser, Gemini prompt schema constructor,
 * and stable UUID generation.
 */

// Section keyword map — fuzzy partial matching used by detectSectionHeader()
const SECTION_KEYWORDS = {
  summary: [
    "summary", "professional summary", "profile", "career summary",
    "about me", "about", "objective", "career objective", "professional profile",
    "personal statement", "overview", "professional overview",
    "summary of qualifications", "executive summary", "introduction"
  ],
  experience: [
    "experience", "work experience", "employment", "employment history",
    "professional experience", "work history", "career history",
    "job history", "relevant experience", "positions held",
    "professional background", "work background", "internships",
    "relevant work", "professional history", "roles"
  ],
  education: [
    "education", "academic background", "academic history",
    "qualifications", "academic qualifications", "educational background",
    "degrees", "schooling", "training", "academic training",
    "educational history", "academic credentials"
  ],
  skills: [
    "skills", "technical skills", "core competencies", "technologies",
    "key skills", "areas of expertise", "competencies", "expertise",
    "tools", "tools & technologies", "technical expertise",
    "programming languages", "languages", "proficiencies",
    "skill set", "skillset", "capabilities", "core skills",
    "skills summary", "technology stack", "tech stack", "technical proficiencies",
    "technical skills summary", "skills & technologies"
  ],
  certifications: [
    "certifications", "licenses", "credentials", "certifications & licenses",
    "certificates", "accreditations", "professional certifications",
    "training & certifications", "awards", "achievements",
    "honors", "honours", "awards & achievements",
    "certification"
  ],
  projects: [
    "projects", "personal projects", "side projects", "notable projects",
    "portfolio", "open source", "publications", "research"
  ]
};

/**
 * Assigns fresh stable UUIDs to all experience, bullets, education, and vault items
 */
function addImportIds(parsedResume) {
  return {
    ...parsedResume,
    experience: (parsedResume.experience || []).map(exp => ({
      ...exp,
      id: generateUUID(),
      bullets: (exp.bullets || []).map(b => ({
        id: generateUUID(),
        text: b.text
      }))
    })),
    education: (parsedResume.education || []).map(edu => ({
      ...edu,
      id: generateUUID()
    })),
    vaultItems: (parsedResume.vaultItems || []).map(item => ({
      ...item,
      id: generateUUID()
    }))
  };
}

/**
 * Parses unformatted text locally using regex section splitting
 * Runs entirely offline.
 */
function parseResumeLocally(text) {
  const lines = text.split(/\r?\n/);
  
  const parsed = {
    contact: {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      portfolio: ""
    },
    summary: "",
    experience: [],
    education: [],
    skills: {
      technical: [],
      tools: [],
      soft: []
    },
    vaultItems: [],
    warnings: []
  };

  // 1. Global Contact Info Regex Extraction
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  parsed.contact.email = emails[0] || "";

  const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = text.match(phoneRegex) || [];
  parsed.contact.phone = phones[0] || "";

  // Extract LinkedIn / portfolio URLs — handles both http:// and bare www. prefixes
  const urlRegex = /(?:https?:\/\/|www\.)[^\s,|)>"]+/gi;
  const urls = text.match(urlRegex) || [];
  urls.forEach(rawUrl => {
    const cleanUrl = rawUrl.replace(/[.,;)>]$/, "");
    const fullUrl = cleanUrl.startsWith("www.") ? "https://" + cleanUrl : cleanUrl;
    if (fullUrl.includes("linkedin.com") && !parsed.contact.linkedin) {
      parsed.contact.linkedin = fullUrl;
    } else if (!parsed.contact.portfolio && !fullUrl.includes("example.com")) {
      parsed.contact.portfolio = fullUrl;
    }
  });

  // Handle "Label: Value" contact lines (e.g. "Name: Vivek Kumar", "Location: Frankfort, KY")
  for (const line of lines) {
    const t = line.trim();
    const labelMatch = t.match(/^(name|location|city|address|phone|mobile|tel):\s*(.+)/i);
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase();
      const value = labelMatch[2].trim();
      if ((label === "name") && !parsed.contact.fullName) parsed.contact.fullName = value;
      if ((label === "location" || label === "city" || label === "address") && !parsed.contact.location) parsed.contact.location = value;
      if ((label === "phone" || label === "mobile" || label === "tel") && !parsed.contact.phone) parsed.contact.phone = value;
    }
    if (detectSectionHeader(t)) break; // stop at first section
  }

  // Fallback: Extract Name and Headline from top block if not found via label
  if (!parsed.contact.fullName) {
    const topLines = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (detectSectionHeader(t)) break;
      topLines.push(t);
      if (topLines.length >= 8) break;
    }
    const CONTACT_NOISE = /[@|\u2022\/(]|https?:|www\.|\d{3}|^\w+:/i;
    for (const t of topLines) {
      if (!parsed.contact.fullName && t.length > 1 && t.length < 55 && !CONTACT_NOISE.test(t)) {
        parsed.contact.fullName = t;
        continue;
      }
      if (parsed.contact.fullName && !parsed.contact.headline && t.length < 100 && !CONTACT_NOISE.test(t)) {
        parsed.contact.headline = t;
        break;
      }
    }
  }

  // Extract headline from "Title | Speciality | ..." line if not yet set
  if (!parsed.contact.headline) {
    for (const line of lines.slice(0, 8)) {
      const t = line.trim();
      if (detectSectionHeader(t)) break;
      // A line with | separators and no @ is likely the headline
      if (t.includes("|") && !t.includes("@") && t.length < 150) {
        parsed.contact.headline = t.replace(/\s*\|\s*/g, " | ").trim();
        break;
      }
    }
  }

  // Extract location from "City, ST" pattern if not set
  if (!parsed.contact.location) {
    const locationMatch = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*,\s*([A-Z]{2})\b/);
    if (locationMatch) parsed.contact.location = locationMatch[0];
  }

  // 2. Section Parsing Loop
  let currentSection = null;
  let sectionContent = [];

  function flushSection() {
    if (!currentSection) return;
    
    const blockText = sectionContent.join("\n").trim();
    if (!blockText) return;

    if (currentSection === "summary") {
      parsed.summary = blockText;
    } else if (currentSection === "skills" || currentSection === "projects") {
      // Handle two formats:
      //  1. Plain comma/newline/pipe list: "C#, React, SQL Server"
      //  2. Category-prefixed bullet: "• Backend & Integration: C#, .NET Core, ASP.NET Core"
      //     → strip the category label, then split on commas
      const rawLines = blockText.split(/\r?\n/);
      const skillTokens = [];
      rawLines.forEach(rawLine => {
        // Strip leading bullet chars (•, -, *, tab)
        let l = rawLine.replace(/^[\s\-•*\u2022\t]+/, "").trim();
        // Strip "Category Label:" prefix  e.g. "Backend & Integration:"
        l = l.replace(/^[^:]+:\s*/, "");
        // Now split on comma, semicolon, pipe, or newline
        l.split(/[,;|]/).forEach(s => {
          const clean = s.replace(/^[\s\-•*]+/, "").trim();
          if (clean && clean.length > 0 && clean.length <= 60) skillTokens.push(clean);
        });
      });
      // Deduplicate case-insensitively
      const seen = new Set();
      const unique = skillTokens.filter(s => {
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      // Heuristic split: items with version numbers or known tool names → tools, rest → technical
      unique.forEach(s => {
        if (/\d/.test(s) || /visual studio|postman|git\b|jira|azure devops|jenkins|docker|iis|ssrs|tfs|power bi|gitlab|github/i.test(s)) {
          parsed.skills.tools.push(s);
        } else {
          parsed.skills.technical.push(s);
        }
      });
    } else if (currentSection === "experience") {
      parseLocalExperience(blockText, parsed.experience);
    } else if (currentSection === "education") {
      parseLocalEducation(blockText, parsed.education);
    } else if (currentSection === "certifications") {
      parseLocalCertifications(blockText, parsed.vaultItems);
    }

    sectionContent = [];
  }

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matchedSection = detectSectionHeader(trimmed);
    if (matchedSection) {
      flushSection();
      currentSection = matchedSection;
    } else {
      if (currentSection) {
        sectionContent.push(line);
      }
    }
  }
  flushSection();

  // Deduplicate and warn if headings look strange
  if (!parsed.summary) {
    parsed.warnings.push({ section: "summary", message: "Professional Summary section heading was not detected." });
  }
  if (parsed.experience.length === 0) {
    parsed.warnings.push({ section: "experience", message: "No experience entries could be identified." });
  }
  if (parsed.education.length === 0) {
    parsed.warnings.push({ section: "education", message: "No education records could be identified." });
  }

  return parsed;
}

/**
 * Fuzzy section header detector.
 * Strips decoration (symbols, numbers, colons, underscores) then checks:
 *   1. Exact match against known aliases
 *   2. The cleaned line IS one of the keywords (handles ALL-CAPS, Title Case, etc.)
 *   3. The line starts with a keyword and is short (likely a header)
 * Returns the section key or null.
 */
function detectSectionHeader(line) {
  // Strip common heading decorations
  const clean = line
    .replace(/^[\s#*=_\-—•►▶]+/, "")  // leading symbols
    .replace(/[\s#*=_\-—•►▶:]+$/, "")  // trailing symbols
    .replace(/^\d+\.?\s*/, "")           // leading numbers
    .trim()
    .toLowerCase();

  if (!clean || clean.length < 3 || clean.length > 50) return null;

  for (const [key, keywords] of Object.entries(SECTION_KEYWORDS)) {
    for (const kw of keywords) {
      // Exact match
      if (clean === kw) return key;
      // Line starts with the keyword and nothing meaningful follows (heading-like)
      if (clean.startsWith(kw) && clean.length < kw.length + 12) return key;
    }
  }
  return null;
}

function isHeaderLine(line) {
  return detectSectionHeader(line) !== null;
}

/**
 * Parse experience entries from local section text blocks
 */
function parseLocalExperience(text, targetArray) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentJob = null;
  let inResponsibilities = false; // track when we are inside a responsibilities block

  // Helpers
  // Matches: "Jan 2020", "January 2020", "07/2023", "2020", "Present", "Current"
  const DATE_PATTERN = /(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}|\d{1,2}\/\d{4}|\d{4})/gi;
  const YEAR_ONLY = /(19|20)\d{2}|\d{1,2}\/\d{4}/;
  const TITLE_KEYWORD = /\b(engineer|developer|manager|specialist|analyst|designer|consultant|director|lead|officer|architect|coordinator|administrator|intern|representative|associate|head|president|vice\s*president|vp|founder|co-founder|practitioner|expert|sr\.?|jr\.?|senior|junior|principal|staff|contractor|contractor)\b/i;
  const COMPANY_KEYWORD = /\b(google|microsoft|amazon|apple|meta|netflix|inc|corp|co\.|llc|solutions|technologies|group|company|systems|software|consulting|industries|university|hospital|bank|labs|design|state of|department|bureau|agency|authority|council)\b/i;
  const BULLET_INDICATOR = /^[-*•▪▫▶§+]\s*|^\d+\.\s+/;
  // Lines to skip inside experience blocks (non-job-entry noise)
  const SKIP_LINE = /^(project\s*(summary|description)?:|responsibilities:|environment:|description:|technologies used:)/i;

  function extractDates(line) {
    const lower = line.toLowerCase();
    const hasPresent = /\bpresent\b|\bcurrent\b/.test(lower);
    // Replace "TO" separator with " " so date regex finds both tokens
    const normalised = line.replace(/\s+TO\s+/gi, " ");
    const dates = (normalised.match(DATE_PATTERN) || []).map(d => d.trim()).filter(Boolean);
    return {
      startDate: dates[0] || "",
      endDate: dates[1] || (hasPresent ? "Present" : ""),
      current: hasPresent
    };
  }

  function isDateOnlyLine(line) {
    const hasDate = YEAR_ONLY.test(line) || /\bpresent\b|\bcurrent\b/i.test(line);
    if (!hasDate) return false;
    const stripped = line
      .replace(DATE_PATTERN, "")
      .replace(/\bpresent\b|\bcurrent\b|\bnow\b/gi, "")
      .replace(/[-–—|\s]+to[\s]+/gi, " ")
      .replace(/[-–—|\s]+/g, " ")
      .trim();
    return stripped.length < 6;
  }

  lines.forEach(line => {
    // ── Skip pure noise header lines ("Project Summary:", "Environment:") ──────
    if (SKIP_LINE.test(line)) {
      // "Responsibilities:" opens the bullet block but does NOT close the job
      if (/^responsibilities:/i.test(line)) inResponsibilities = true;
      return;
    }

    // ── CLIENT: Company Name prefix ──────────────────────────────────────────
    const clientMatch = line.match(/^CLIENT:\s*(.+)/i);
    if (clientMatch) {
      inResponsibilities = false;
      const rawCompanyLine = clientMatch[1];
      const { startDate, endDate, current } = extractDates(rawCompanyLine);
      const company = rawCompanyLine.replace(DATE_PATTERN, "").replace(/\s+TO\s+/gi, " ").replace(/[,(].*$/, "").replace(/[-–—|\s]+$/, "").trim();
      currentJob = { company, title: '', location: '', startDate, endDate, current, bullets: [] };
      targetArray.push(currentJob);
      return;
    }

    // ── If inside a responsibilities block, everything is a bullet ────────────
    if (inResponsibilities && currentJob) {
      const cleanBullet = line.replace(/^[-*\u2022\u25aa\u25ab\u25b6\u00a7+\d.]+\s*/, '').trim();
      if (cleanBullet) currentJob.bullets.push({ text: cleanBullet });
      return;
    }

    // ── Bullet line ──────────────────────────────────────────────────────────
    if (BULLET_INDICATOR.test(line)) {
      inResponsibilities = false;
      const cleanBullet = line.replace(/^[-*\u2022\u25aa\u25ab\u25b6\u00a7+\d.]+\s*/, '').trim();
      if (cleanBullet) {
        if (!currentJob) {
          currentJob = { company: 'Unknown Company', title: 'Professional Title', location: '', startDate: '', endDate: '', current: false, bullets: [] };
          targetArray.push(currentJob);
        }
        currentJob.bullets.push({ text: cleanBullet });
      }
      return;
    }

    // ── Date-only continuation line (patch current job) ──────────
    if (isDateOnlyLine(line) && currentJob && !currentJob.startDate) {
      const { startDate, endDate, current } = extractDates(line);
      currentJob.startDate = startDate;
      currentJob.endDate = endDate;
      currentJob.current = current;
      inResponsibilities = false;
      return;
    }

    // ── Title-only continuation: patch current CLIENT:-created job ──
    if (currentJob && !currentJob.title && TITLE_KEYWORD.test(line) && !YEAR_ONLY.test(line)) {
      // Strip trailing period + anything after ("Senior. Dot Net Developer" → "Senior Dot Net Developer")
      currentJob.title = line.replace(/\.(?=\s)/g, '').trim();
      inResponsibilities = false;
      return;
    }

    // ── Job header line ──────────────────────────────────────────
    const hasDate = YEAR_ONLY.test(line) || /\bpresent\b|\bcurrent\b/i.test(line);
    const hasTitleKeyword = TITLE_KEYWORD.test(line);
    const hasCompanyKeyword = COMPANY_KEYWORD.test(line);
    const isJobHeader = currentJob === null || hasTitleKeyword || hasCompanyKeyword || hasDate;

    if (isJobHeader) {
      const { startDate, endDate, current } = extractDates(line);

      // Split on common delimiters to get company vs title
      const parts = line.split(/\s*[-–—|@]\s*/);
      let company = "Company";
      let title = "Role";

      if (parts.length > 1) {
        company = parts[0].replace(DATE_PATTERN, "").replace(/\bpresent\b|\bcurrent\b/gi, "").trim() || "Company";
        title   = parts[1].replace(DATE_PATTERN, "").replace(/\bpresent\b|\bcurrent\b/gi, "").trim() || "Role";
      } else {
        // Single-token line — if it has a title keyword, it's a title (for CLIENT: format)
        const cleaned = line.replace(DATE_PATTERN, "").replace(/\bpresent\b|\bcurrent\b/gi, "").trim();
        if (hasTitleKeyword && !hasCompanyKeyword && currentJob) {
          // Patch title on existing job rather than creating duplicate
          if (!currentJob.title) currentJob.title = cleaned || "Role";
          return;
        }
        title = cleaned || "Role";
      }

      currentJob = { company, title, location: "", startDate, endDate, current, bullets: [] };
      targetArray.push(currentJob);
    } else {
      // Treat as a plain-text bullet if we have an active job
      if (currentJob && line.length > 0) {
        currentJob.bullets.push({ text: line });
      }
    }
  });
}


/**
 * Parse education entries from local section text blocks.
 * Groups multi-line blocks: school name, degree, and year can each be on separate lines.
 */
function parseLocalEducation(text, targetArray) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const YEAR_RE = /^(19|20)\d{2}$/;
  const YEAR_INLINE = /(19|20)\d{2}/;
  const DEGREE_KEYWORDS = /\b(bachelor|master|phd|ph\.d|b\.s|m\.s|b\.a|m\.a|bs|ms|mba|associate|degree|diploma|certification|certificate)\b/i;
  const SCHOOL_KEYWORDS = /\b(university|college|school|institute|academy|polytechnic)\b/i;

  let currentEdu = null;

  const commitEdu = () => {
    if (currentEdu) {
      targetArray.push(currentEdu);
      currentEdu = null;
    }
  };

  lines.forEach(line => {
    const isYearOnly = YEAR_RE.test(line.replace(/[()[\]]/g, "").trim());
    const hasDegree = DEGREE_KEYWORDS.test(line);
    const hasSchool = SCHOOL_KEYWORDS.test(line);
    const hasYear   = YEAR_INLINE.test(line);

    // ── Year-only line → patch current entry's gradDate ──────────
    if (isYearOnly && currentEdu && !currentEdu.gradDate) {
      currentEdu.gradDate = line.replace(/[()[\]]/g, "").trim();
      return;
    }

    // ── Degree continuation → patch current entry ─────────────────
    // Fires when a degree line follows a school-name line (e.g. MIT → Bachelor of Science)
    if (hasDegree && currentEdu && !currentEdu.degreeSet) {
      currentEdu.degree = line.replace(YEAR_INLINE, "").trim() || currentEdu.degree;
      currentEdu.degreeSet = true;
      if (hasYear && !currentEdu.gradDate) {
        const m = line.match(YEAR_INLINE);
        if (m) currentEdu.gradDate = m[0];
      }
      return;
    }

    // ── New education entry — school keyword or combined degree+school line ──
    if (hasSchool || (hasDegree && !currentEdu)) {
      commitEdu();
      let school = line;
      let degree = "";
      let gradDate = "";
      let field = "";

      // Inline year extraction
      const yearMatch = line.match(YEAR_INLINE);
      if (yearMatch) {
        gradDate = yearMatch[0];
        school = line.replace(YEAR_INLINE, "").trim();
      }

      // Split on comma or em-dash to separate school from degree/field on same line
      const parts = line.split(/\s*[,–—]\s*/);
      if (parts.length >= 2) {
        school = parts[0].replace(YEAR_INLINE, "").trim();
        degree = parts[1].replace(YEAR_INLINE, "").trim();
        if (parts.length >= 3) field = parts[2].replace(YEAR_INLINE, "").trim();
        if (!gradDate && parts[parts.length - 1].match(YEAR_INLINE)) {
          gradDate = parts[parts.length - 1].match(YEAR_INLINE)[0];
        }
      }

      currentEdu = {
        school: school || "University/College",
        degree: degree || "Degree",
        field: field || "",
        gradDate: gradDate,
        degreeSet: Boolean(degree)
      };
      return;
    }

    // ── Standalone school name (e.g. "MIT", "Stanford") ──────────
    // Short line, no degree keywords, no year → likely a bare institution name
    if (!currentEdu && !hasDegree && !hasYear && line.length <= 60) {
      commitEdu();
      currentEdu = {
        school: line,
        degree: "Degree",
        field: "",
        gradDate: "",
        degreeSet: false
      };
      return;
    }

    // ── Field annotation / year patch for current entry ───────────
    if (currentEdu && line.length < 60) {
      if (!currentEdu.field && !hasDegree && !hasYear) {
        currentEdu.field = line.trim();
      }
      if (!currentEdu.gradDate && hasYear) {
        const m = line.match(YEAR_INLINE);
        if (m) currentEdu.gradDate = m[0];
      }
    }
  });

  commitEdu();
}

/**
 * Parse certifications from local section text blocks
 */
function parseLocalCertifications(text, targetArray) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  lines.forEach(line => {
    // Skip lines that are really section headers (e.g. "CORE SKILLS" bleeding in)
    if (detectSectionHeader(line)) return;
    // Skip very long lines that look like skill categories, not cert names
    if (line.length > 120) return;

    // Strip leading bullet characters: •, -, *, tab, digit+dot
    const stripped = line.replace(/^[\s•\-*\u2022\t]+/, "").trim();
    if (!stripped || stripped.length < 3) return;

    let date = "";
    const dateMatch = stripped.match(/(19|20)\d{2}/);
    if (dateMatch) date = dateMatch[0];

    // Strip the year token from the name
    const name = stripped.replace(/\(?\d{4}\)?/g, "").trim();
    if (!name) return;

    targetArray.push({
      type: "certification",
      name,
      issuer: "Credential Issuer",
      date,
      aliases: [],
      keywords: [],
      active: true
    });
  });
}
