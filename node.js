const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// মিডলওয়্যার সেটআপ
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// আপলোড ডিরেক্টরি তৈরি
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// মাল্টার কনফিগারেশন
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// রাউটস
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// কন্টেন্ট লিস্ট এপিআই
app.get('/api/contents', (req, res) => {
    const type = req.query.type;
    
    try {
        let contents = [];
        if (fs.existsSync('data/contents.json')) {
            const data = fs.readFileSync('data/contents.json', 'utf8');
            contents = JSON.parse(data);
        }
        
        if (type) {
            contents = contents.filter(content => content.type === type);
        }
        
        res.json(contents);
    } catch (error) {
        res.status(500).json({ error: 'ডেটা লোড করতে সমস্যা হয়েছে' });
    }
});

// কন্টেন্ট আপলোড এপিআই
app.post('/api/contents', upload.single('file'), (req, res) => {
    const { type, title, description, content } = req.body;
    const file = req.file;
    
    if (!type || !title || !description || !file) {
        return res.status(400).json({ error: 'সমস্ত ফিল্ড পূরণ করুন' });
    }
    
    try {
        let contents = [];
        if (fs.existsSync('data/contents.json')) {
            const data = fs.readFileSync('data/contents.json', 'utf8');
            contents = JSON.parse(data);
        }
        
        const newContent = {
            id: Date.now(),
            type,
            title,
            description,
            content: content || '',
            file: {
                name: file.originalname,
                path: file.path,
                mimetype: file.mimetype
            },
            date: new Date().toLocaleDateString('bn-BD')
        };
        
        contents.push(newContent);
        
        // ডেটা ডিরেক্টরি তৈরি
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }
        
        fs.writeFileSync('data/contents.json', JSON.stringify(contents, null, 2));
        
        res.json({ message: 'কন্টেন্ট সফলভাবে আপলোড হয়েছে', content: newContent });
    } catch (error) {
        res.status(500).json({ error: 'কন্টেন্ট আপলোড করতে সমস্যা হয়েছে' });
    }
});

// কন্টেন্ট ডিলিট এপিআই
app.delete('/api/contents/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
        let contents = [];
        if (fs.existsSync('data/contents.json')) {
            const data = fs.readFileSync('data/contents.json', 'utf8');
            contents = JSON.parse(data);
        }
        
        const contentIndex = contents.findIndex(content => content.id === id);
        
        if (contentIndex === -1) {
            return res.status(404).json({ error: 'কন্টেন্ট পাওয়া যায়নি' });
        }
        
        // ফাইল ডিলিট
        const filePath = contents[contentIndex].file.path;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        contents.splice(contentIndex, 1);
        fs.writeFileSync('data/contents.json', JSON.stringify(contents, null, 2));
        
        res.json({ message: 'কন্টেন্ট সফলভাবে ডিলিট হয়েছে' });
    } catch (error) {
        res.status(500).json({ error: 'কন্টেন্ট ডিলিট করতে সমস্যা হয়েছে' });
    }
});

// ফাইল ডাউনলোড এপিআই
app.get('/api/download/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    try {
        let contents = [];
        if (fs.existsSync('data/contents.json')) {
            const data = fs.readFileSync('data/contents.json', 'utf8');
            contents = JSON.parse(data);
        }
        
        const content = contents.find(c => c.id === id);
        
        if (!content) {
            return res.status(404).json({ error: 'কন্টেন্ট পাওয়া যায়নি' });
        }
        
        if (!fs.existsSync(content.file.path)) {
            return res.status(404).json({ error: 'ফাইল পাওয়া যায়নি' });
        }
        
        res.download(content.file.path, content.file.name);
    } catch (error) {
        res.status(500).json({ error: 'ফাইল ডাউনলোড করতে সমস্যা হয়েছে' });
    }
});

// সার্ভার শুরু
app.listen(PORT, () => {
    console.log(`সার্ভার চলছে http://localhost:${PORT}`);
});
