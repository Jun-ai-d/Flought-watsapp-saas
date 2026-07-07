const fs = require('fs');
const path = require('path');

const files = [
  'src/components/AdminLayout.tsx',
  'src/pages/admin/AdminOverview.tsx',
  'src/pages/admin/AdminTenants.tsx',
  'src/pages/admin/AdminProvisioning.tsx',
  'src/pages/admin/AdminBilling.tsx',
  'src/pages/admin/AdminUsers.tsx'
];

const replacements = [
  { regex: /bg-slate-950/g, replacement: 'bg-[#FAFAFA]' },
  { regex: /bg-slate-900/g, replacement: 'bg-white' },
  { regex: /border-slate-800/g, replacement: 'border-[#EAEAEA]' },
  { regex: /border-slate-700/g, replacement: 'border-[#EAEAEA]' },
  
  { regex: /text-slate-100/g, replacement: 'text-[#00221A]' },
  { regex: /text-slate-200/g, replacement: 'text-[#00221A]' },
  { regex: /text-slate-300/g, replacement: 'text-[#00221A]' },
  { regex: /text-slate-400/g, replacement: 'text-[#4A6B5D]' },
  { regex: /text-slate-500/g, replacement: 'text-[#4A6B5D]' },
  
  { regex: /text-indigo-500/g, replacement: 'text-[#002E23]' },
  { regex: /text-indigo-400/g, replacement: 'text-[#002E23]' },
  { regex: /text-indigo-300/g, replacement: 'text-[#002E23]' },
  
  { regex: /bg-indigo-900\/40/g, replacement: 'bg-[#002E23]/10' },
  { regex: /bg-indigo-900\/50/g, replacement: 'bg-[#002E23]/10' },
  { regex: /border-indigo-700\/50/g, replacement: 'border-[#002E23]/20' },
  
  { regex: /hover:bg-slate-800\/50/g, replacement: 'hover:bg-[#EAEAEA]/50' },
  { regex: /bg-slate-800/g, replacement: 'bg-[#EAEAEA]' },
  
  { regex: /text-white/g, replacement: 'text-[#00221A]' }, // Watch out for buttons that should be text-white! We'll fix manually if needed.
  { regex: /bg-indigo-600/g, replacement: 'bg-[#002E23]' },
  
  // Specific fixes to avoid breaking standard white text where needed (like logo bg):
  // I will skip text-white globally and only fix specific instances if necessary, or just run it and see.
  // Actually, replacing text-white with text-[#00221A] globally might break buttons. Let's not do that globally.
];

// Let's refine the replacements
const refinedReplacements = [
  { regex: /bg-slate-950/g, replacement: 'bg-theme-bg' },
  { regex: /bg-slate-900/g, replacement: 'bg-theme-surface' },
  { regex: /bg-slate-800/g, replacement: 'bg-theme-surface-hover' },
  { regex: /border-slate-800/g, replacement: 'border-theme-border' },
  { regex: /border-slate-700/g, replacement: 'border-theme-border' },
  
  { regex: /text-slate-100/g, replacement: 'text-theme-text' },
  { regex: /text-slate-200/g, replacement: 'text-theme-text' },
  { regex: /text-slate-300/g, replacement: 'text-theme-text' },
  { regex: /text-slate-400/g, replacement: 'text-theme-text-muted' },
  { regex: /text-slate-500/g, replacement: 'text-theme-text-muted' },
  
  { regex: /text-indigo-500/g, replacement: 'text-brand-accent' },
  { regex: /text-indigo-400/g, replacement: 'text-brand-accent' },
  { regex: /text-indigo-300/g, replacement: 'text-brand-accent' },
  { regex: /text-indigo-600/g, replacement: 'text-brand-accent' },
  
  { regex: /bg-indigo-900\/40/g, replacement: 'bg-brand-accent/10' },
  { regex: /bg-indigo-900\/50/g, replacement: 'bg-brand-accent/10' },
  { regex: /border-indigo-700\/50/g, replacement: 'border-brand-accent/20' },
  { regex: /border-indigo-500\/50/g, replacement: 'border-brand-accent/50' },
  
  { regex: /hover:bg-slate-800\/50/g, replacement: 'hover:bg-theme-surface-hover' },
  { regex: /hover:border-slate-700/g, replacement: 'hover:border-theme-border' },
  { regex: /hover:text-white/g, replacement: 'hover:text-theme-text' },
  { regex: /text-white/g, replacement: 'text-theme-text' },
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    refinedReplacements.forEach(rep => {
      content = content.replace(rep.regex, rep.replacement);
    });
    // Let's protect specific instances where text-white was needed, like the "Sign Out" button or the logo.
    // Actually, text-theme-text will just become black in light mode, which is fine for most things.
    // For primary buttons, usually they use bg-theme-text text-theme-bg, but let's see.
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Missing ${file}`);
  }
});
