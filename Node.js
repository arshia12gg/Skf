const express = require('express');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(fileUpload());
app.use(express.static('public'));

// تنظیمات GitHub
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = 'your-github-token'; // جایگزین کنید با توکن واقعی

// تابع برای ایجاد ریپوی جدید
async function createRepo(repoName) {
  try {
    const response = await axios.post(`${GITHUB_API}/user/repos`, {
      name: repoName,
      auto_init: true
    }, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating repo:', error.response.data);
    throw error;
  }
}

// تابع برای آپلود فایل به ریپو
async function uploadToGitHub(repoName, htmlContent, username) {
  const repoUrl = `https://github.com/${username}/${repoName}.git`;
  const tempDir = path.join(__dirname, 'temp', repoName);
  
  // ایجاد پوشه موقت
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // کلون ریپو
  const git = simpleGit(tempDir);
  await git.clone(repoUrl, tempDir);
  
  // ذخیره فایل HTML
  fs.writeFileSync(path.join(tempDir, 'index.html'), htmlContent);
  
  // کامیت و پوش
  await git.add('.');
  await git.commit('Add HTML file');
  await git.push('origin', 'main');
  
  // فعال‌سازی GitHub Pages
  await axios.post(`${GITHUB_API}/repos/${username}/${repoName}/pages`, {
    source: {
      branch: "main",
      path: "/"
    }
  }, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  return `https://${username}.github.io/${repoName}`;
}

// Route برای آپلود
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.htmlFile) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.files.htmlFile;
  const repoName = `html-site-${Date.now()}`;
  
  try {
    // ایجاد ریپوی جدید
    const repo = await createRepo(repoName);
    
    // آپلود فایل به ریپو
    const siteUrl = await uploadToGitHub(repoName, file.data.toString(), repo.owner.login);
    
    res.json({ 
      success: true,
      url: siteUrl,
      repoUrl: repo.html_url
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to publish site' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
