/* Resume.AI Mock Data Sandbox - Phase 2 */

const MOCK_DATA = {
  version: 1,
  resume: {
    contact: {
      fullName: "John Doe",
      headline: "Software Engineer",
      email: "john.doe@example.com",
      phone: "+1 (555) 019-2834",
      location: "San Francisco, CA",
      linkedin: "https://linkedin.com/in/johndoe",
      portfolio: "https://johndoe.dev"
    },
    summary: "Experienced Software Engineer specializing in modern frontend architectures and high-performance client applications. Proven history of building responsive web applications.",
    experience: [
      {
        id: "exp-mock-1",
        company: "Innovate Tech Solutions",
        title: "Frontend Engineer",
        location: "San Francisco, CA",
        startDate: "Jan 2024",
        endDate: "Present",
        current: true,
        bullets: [
          {
            id: "bullet-mock-1",
            text: "Responsible for building application components."
          },
          {
            id: "bullet-mock-2",
            text: "Helped fix bugs in the frontend client application."
          },
          {
            id: "bullet-mock-3",
            text: "Worked with a team on multiple frontend projects."
          }
        ]
      }
    ],
    education: [
      {
        id: "edu-mock-1",
        school: "State University",
        degree: "Bachelor of Science",
        field: "Computer Science",
        gradDate: "May 2023"
      }
    ],
    skills: {
      technical: ["JavaScript", "HTML", "CSS", "React"],
      tools: ["Git", "VS Code", "Webpack"]
    }
  },
  vault: [
    {
      id: "vault-mock-cert-1",
      type: "certification",
      name: "AWS Certified Solutions Architect",
      issuer: "Amazon Web Services",
      date: "Dec 2024",
      aliases: ["AWS CSA", "AWS Architect"],
      keywords: ["AWS", "Cloud", "Solutions Architect"],
      active: false
    },
    {
      id: "vault-mock-cert-2",
      type: "certification",
      name: "Certified ScrumMaster (CSM)",
      issuer: "Scrum Alliance",
      date: "Jan 2025",
      aliases: ["CSM", "Scrum Master"],
      keywords: ["Scrum", "Agile", "ScrumMaster"],
      active: false
    },
    {
      id: "vault-mock-cert-3",
      type: "certification",
      name: "ServSafe Food Safety Manager",
      issuer: "National Restaurant Association",
      date: "Aug 2022",
      aliases: ["ServSafe", "Food Safety"],
      keywords: ["Food Safety", "Sanitation"],
      active: false
    }
  ],
  jobDescription: "We are looking for a Senior Software Engineer with experience in React, TypeScript, and cloud deployment. AWS Certification is highly preferred. The ideal candidate will write clean, well-tested code, take ownership of features, and optimize frontend load times.",
  analysis: {
    ats: {
      total: 62,
      categories: {
        coreSections: {
          score: 18,
          maximum: 20,
          findings: ["All core sections (Contact, Summary, Experience, Education, Skills) are present."]
        },
        keywordCoverage: {
          score: 14,
          maximum: 30,
          findings: [
            "Matches found for key skills: React, JavaScript, HTML, CSS.",
            "Missing critical job description target terms: TypeScript, cloud deployment, optimization, ownership."
          ]
        },
        skillsAndCertifications: {
          score: 12,
          maximum: 20,
          findings: [
            "Technical skill and tools lists are populated.",
            "AWS certification is preferred by the employer but is currently missing from your resume."
          ]
        },
        bulletQuality: {
          score: 10,
          maximum: 20,
          findings: [
            "Bullet points lack numerical metrics or evidence of scale.",
            "Passive language detected: 'Responsible for...', 'Helped fix...'."
          ]
        },
        contactAndFormatting: {
          score: 8,
          maximum: 10,
          findings: ["Location, Email, and links are formatted correctly."]
        }
      }
    },
    recruiterReview: {
      firstImpression: "Reads like a junior-to-mid-level developer who focuses on tasks rather than ownership. Headline lacks instant punch.",
      visibleStrengths: [
        "Clear chronologically structured work experience block.",
        "Well-structured skills lists."
      ],
      attentionProblems: [
        "Professional summary is generic and lacks quantifiable career highlights.",
        "First bullet point doesn't specify what components were developed or their value."
      ],
      heatmapRegions: [
        { section: "contact", attention: "high", reason: "Brief check of location and links." },
        { section: "summary", attention: "high", reason: "Standard scan of summary statement." },
        { section: "experience", attention: "high", reason: "Primary focus section for evaluating career growth." },
        { section: "skills", attention: "medium", reason: "Double check of technical stack checklists." },
        { section: "education", attention: "low", reason: "Brief confirmation of BS degree." }
      ]
    },
    hiringManagerReview: {
      overallAssessment: "Strong technical core but bullet points read like a list of daily duties rather than professional accomplishments.",
      concerns: [
        "No mention of automated testing or code quality practices.",
        "Lacks metrics illustrating optimization capabilities, which is a major job description request."
      ],
      interviewSignals: [
        "React frontend familiarity aligns well with requirements.",
        "State University CS degree fits target credentials."
      ]
    },
    rewrites: [
      {
        experienceId: "exp-mock-1",
        bulletId: "bullet-mock-1",
        original: "Responsible for building application components.",
        suggested: "Engineered reusable React/TypeScript application components, accelerating team feature delivery speed.",
        reason: "Replaces passive 'Responsible for' with active verb 'Engineered' and targets React/TypeScript technologies."
      },
      {
        experienceId: "exp-mock-1",
        bulletId: "bullet-mock-2",
        original: "Helped fix bugs in the frontend client application.",
        suggested: "Debugged and resolved critical frontend rendering performance bottlenecks, improving layout speed.",
        reason: "Shows ownership and focus on performance, matching target requirements."
      },
      {
        experienceId: "exp-mock-1",
        bulletId: "bullet-mock-3",
        original: "Worked with a team on multiple frontend projects.",
        suggested: "Collaborated in an agile engineering team to ship production web features under tight deadlines.",
        reason: "Shows agile methodology alignment, collaboration, and high-impact delivery."
      }
    ],
    vaultSuggestions: [
      {
        vaultItemId: "vault-mock-cert-1",
        action: "add",
        reason: "The Job Description states: 'AWS Certification is highly preferred'. Showing your 'AWS Certified Solutions Architect' credential will improve ATS relevance.",
        matchedJobRequirement: "AWS Certification is highly preferred"
      },
      {
        vaultItemId: "vault-mock-cert-3",
        action: "remove",
        reason: "Food safety license is not relevant for software engineering. Hide it to optimize page space.",
        matchedJobRequirement: ""
      }
    ]
  }
};
