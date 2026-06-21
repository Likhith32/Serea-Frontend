"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Key, 
  Upload, 
  Download, 
  AlertCircle, 
  Loader2, 
  X, 
  ArrowRight,
  BookOpen,
  Maximize2,
  Send,
  MessageSquare
} from "lucide-react";

// API Base URL - configurable via env var
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SearchResult {
  page: number;
  text: string;
}

interface PDFMetadata {
  title: string;
  author: string;
}

const HamsterLoader = () => (
  <div aria-label="Orange and tan hamster running in a metal wheel" role="img" className="wheel-and-hamster mx-auto scale-90 transition-all duration-300">
    <div className="wheel border-4 border-[#E5DEC9]"></div>
    <div className="hamster">
      <div className="hamster__body">
        <div className="hamster__head">
          <div className="hamster__ear"></div>
          <div className="hamster__eye"></div>
          <div className="hamster__nose"></div>
        </div>
        <div className="hamster__limb hamster__limb--fr"></div>
        <div className="hamster__limb hamster__limb--fl"></div>
        <div className="hamster__limb hamster__limb--br"></div>
        <div className="hamster__limb hamster__limb--bl"></div>
        <div className="hamster__tail"></div>
      </div>
    </div>
    <div className="spoke"></div>
  </div>
);

export default function Home() {
  // File States
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pdfMetadata, setPdfMetadata] = useState<PDFMetadata | null>(null);
  
  // Loading & Error States
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // App Options & Active View States
  const [activeTab, setActiveTab] = useState<"normal" | "keyword-summary" | "keyword-search">("normal");
  
  // Results Cache
  const [normalSummary, setNormalSummary] = useState<string | null>(null);
  
  const [keyword, setKeyword] = useState("");
  const [keywordSummary, setKeywordSummary] = useState<string | null>(null);
  const [lastSummaryKeyword, setLastSummaryKeyword] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [lastSearchTerm, setLastSearchTerm] = useState("");
  
  // Drag and Drop State
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat & Form States
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [hasFormFields, setHasFormFields] = useState(false);
  const [formFieldsList, setFormFieldsList] = useState<any[]>([]);
  const [isDownloadingForm, setIsDownloadingForm] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pre-warm backend on mount (especially useful for Render's free tier sleep)
  useEffect(() => {
    fetch(`${API_BASE}/`).catch((err) => {
      console.log("Pre-warming backend ping failed or is waking up:", err);
    });
  }, []);

  // Clean up PDF URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isChatThinking]);

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  // Handle Drag Leave
  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndUpload(droppedFile);
    }
  };

  // Handle File Selector
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  // Check form fields helper
  const checkFormFields = async (sid: string) => {
    try {
      const response = await fetch(`${API_BASE}/form-fields?session_id=${sid}`);
      const data = await response.json();
      if (response.ok && data.fields && data.fields.length > 0) {
        setHasFormFields(true);
        setFormFieldsList(data.fields);
      } else {
        setHasFormFields(false);
        setFormFieldsList([]);
      }
    } catch (err) {
      console.error("Error checking form fields:", err);
    }
  };

  // Validate File and Upload to Backend
  const validateAndUpload = async (selectedFile: File) => {
    setError(null);
    
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      setError("Please upload a valid PDF file.");
      return;
    }
    
    // 20MB limit
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File is too large. Maximum upload size is 20MB.");
      return;
    }
    
    setFile(selectedFile);
    
    // Revoke previous URL if exists
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(URL.createObjectURL(selectedFile));
    
    setIsUploading(true);
    
    // Reset output states
    setSessionId(null);
    setNormalSummary(null);
    setKeywordSummary(null);
    setSearchResults([]);
    setKeyword("");
    setSearchTerm("");
    setChatHistory([]);
    setChatInput("");
    setHasFormFields(false);
    setFormFieldsList([]);
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to upload and parse the PDF.");
      }
      
      setSessionId(data.session_id);
      setPageCount(data.page_count);
      setPdfMetadata(data.metadata);
      checkFormFields(data.session_id);
    } catch (err: any) {
      setError(err.message || "An error occurred while uploading. Ensure the backend server is running.");
      setFile(null);
      setPdfUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Call API for Normal Summary
  const handleGenerateNormalSummary = async () => {
    if (!sessionId) return;
    setError(null);
    setIsLoadingResult(true);
    
    try {
      const response = await fetch(`${API_BASE}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate summary.");
      }
      
      setNormalSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Error generating summary.");
    } finally {
      setIsLoadingResult(false);
    }
  };

  // Call API for Keyword Focused Summary
  const handleGenerateKeywordSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !keyword.trim()) return;
    setError(null);
    setIsLoadingResult(true);
    
    try {
      const response = await fetch(`${API_BASE}/summarize-keyword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, keyword: keyword.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate keyword summary.");
      }
      
      setKeywordSummary(data.summary);
      setLastSummaryKeyword(keyword.trim());
    } catch (err: any) {
      setError(err.message || "Error generating keyword summary.");
    } finally {
      setIsLoadingResult(false);
    }
  };

  // Call API for Keyword Search
  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !searchTerm.trim()) return;
    setError(null);
    setIsLoadingResult(true);
    
    try {
      const response = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, search_term: searchTerm.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to complete search.");
      }
      
      setSearchResults(data.results);
      setLastSearchTerm(searchTerm.trim());
    } catch (err: any) {
      setError(err.message || "Error performing search.");
    } finally {
      setIsLoadingResult(false);
    }
  };

  // Chat message send handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !chatInput.trim() || isChatThinking) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    
    const newHistory = [...chatHistory, { role: "user" as const, content: userMsg }];
    setChatHistory(newHistory);
    setIsChatThinking(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMsg,
          history: chatHistory
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to get response from Serea.");
      }

      setChatHistory(prev => [...prev, { role: "assistant" as const, content: data.response }]);
    } catch (err: any) {
      setError(err.message || "An error occurred in chat.");
    } finally {
      setIsChatThinking(false);
    }
  };

  // Download filled PDF handler
  const handleDownloadFilledPDF = async () => {
    if (!sessionId) return;
    setIsDownloadingForm(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/fill-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate filled PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `filled_${pdfMetadata?.title || "form"}.pdf`;
      if (contentDisposition) {
        const matches = /filename="?([^"]+)"?/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "An error occurred while downloading the filled PDF.");
    } finally {
      setIsDownloadingForm(false);
    }
  };

  // Client-side Text download
  const handleDownloadResult = () => {
    let content = "";
    let suffix = "";
    
    if (activeTab === "normal" && normalSummary) {
      content = `SUMMARY REPORT - NORMAL SUMMARIZER\nDocument: ${file?.name}\nPages: ${pageCount}\n\n${normalSummary}`;
      suffix = "normal_summary";
    } else if (activeTab === "keyword-summary" && keywordSummary) {
      content = `SUMMARY REPORT - KEYWORD SUMMARIZER\nDocument: ${file?.name}\nKeyword: ${lastSummaryKeyword}\n\n${keywordSummary}`;
      suffix = `keyword_${lastSummaryKeyword.replace(/\s+/g, "_")}`;
    } else if (activeTab === "keyword-search" && searchResults.length > 0) {
      content = `SEARCH RESULTS\nDocument: ${file?.name}\nSearch Term: ${lastSearchTerm}\n\nTotal Matches: ${searchResults.length}\n\n`;
      searchResults.forEach((r, i) => {
        content += `[Match #${i + 1} | Page ${r.page}]\n"${r.text}"\n\n`;
      });
      suffix = `search_${lastSearchTerm.replace(/\s+/g, "_")}`;
    }
    
    if (!content) return;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.replace(".pdf", "")}_${suffix}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper function to escape regex characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // Helper to highlight matching keyword in text
  const highlightMatches = (text: string, term: string) => {
    if (!term) return text;
    try {
      const escaped = escapeRegExp(term);
      const parts = text.split(new RegExp(`(${escaped})`, "gi"));
      return (
        <span>
          {parts.map((part, index) => 
            part.toLowerCase() === term.toLowerCase() ? (
              <mark key={index} className="bg-[#FAF0D7] text-[#4E4537] rounded border border-[#DFD3C3] px-1 font-semibold shadow-sm">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return text;
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const content = isBullet ? line.trim().substring(2) : line;
      
      const parts = content.split(/(\*\*.*?\*\*)/g);
      const renderedLine = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="font-bold text-[#2E2A25] bg-[#FAF7F2] border border-[#E5DEC9]/60 px-1.5 py-0.5 rounded">{part.slice(2, -2)}</strong>;
        }
        return <span key={j}>{part}</span>;
      });

      if (isBullet) {
        return (
          <div key={i} className="flex gap-2.5 mb-2.5 ml-4">
            <span className="text-[#8B7D6B] font-bold">•</span>
            <div className="flex-1 text-[#2E2A25]">{renderedLine}</div>
          </div>
        );
      }
      return <div key={i} className="mb-2.5 text-[#2E2A25]">{renderedLine}</div>;
    });
  };

  const handleReset = () => {
    setFile(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
    setSessionId(null);
    setNormalSummary(null);
    setKeywordSummary(null);
    setSearchResults([]);
    setKeyword("");
    setSearchTerm("");
    setChatHistory([]);
    setChatInput("");
    setHasFormFields(false);
    setFormFieldsList([]);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7F0] text-[#2E2A25] antialiased font-sans transition-colors duration-500">
      
      {/* Sleek Minimalist Header */}
      <header className="border-b border-[#E5DEC9] bg-white/95 sticky top-0 z-30 shadow-[0_2px_8px_rgba(78,69,55,0.02)] backdrop-blur-md">
        <div className="max-w-[1600px] w-full mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 relative overflow-hidden rounded-xl border border-[#E5DEC9] shadow-sm flex items-center justify-center bg-white hover:scale-105 transition-all duration-300">
              <img src="/logo.jpg" alt="SEREA logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-[#2E2A25]">
                SEREA
              </h1>
              <p className="text-xs text-[#8B7D6B] font-semibold tracking-wide">
                Gemini LLM PDF Summarizer
              </p>
            </div>
          </div>
          {file && (
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-4.5 py-2 rounded-xl text-sm font-bold text-[#6E6454] hover:text-[#2E2A25] bg-white hover:bg-[#FAF7F2] transition-all duration-200 border border-[#E5DEC9] shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
              Upload New
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex flex-col justify-center py-8 px-8">
        <div className="max-w-[1600px] w-full mx-auto flex-grow flex flex-col">
          
          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-5 bg-[#FAF3F0] border border-[#E5C9C9] rounded-2xl flex gap-3.5 items-start animate-in fade-in slide-in-from-top-3 duration-300">
              <AlertCircle className="h-5.5 w-5.5 text-red-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-950">Processing Error</h3>
                <p className="text-sm text-red-800 mt-0.5 font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-[#8B7D6B] hover:text-[#2E2A25] transition-colors">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          )}

          {/* Initial Upload Phase */}
          {!file && (
            <div className="max-w-xl mx-auto my-auto py-16 w-full animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-extrabold tracking-tight text-[#2E2A25]">
                  Extract insights instantly
                </h2>
                <p className="mt-3 text-sm text-[#6E6454] leading-relaxed">
                  Upload a PDF to generate summaries, extract keywords, or search sentences using Gemini LLM.
                </p>
              </div>

              {/* Upload Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer border border-dashed rounded-3xl p-16 text-center transition-all duration-300 bg-white ${
                  isDragOver 
                    ? "border-[#4E4537] bg-[#FAF7F2] shadow-md" 
                    : "border-[#E5DEC9] hover:border-[#8B7D6B] hover:shadow-[0_12px_30px_rgba(78,69,55,0.06)] shadow-sm"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center py-6">
                    <HamsterLoader />
                    <h3 className="mt-6 text-sm font-bold text-[#2E2A25]">Parsing PDF Content</h3>
                    <p className="mt-2 text-xs text-[#8B7D6B] font-medium">
                      Extracting text and chunking pages for Gemini...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <div className="p-4.5 bg-[#FAF7F2] rounded-2xl group-hover:bg-[#FAF7F0] transition-all duration-300 text-[#4E4537] group-hover:scale-110">
                      <Upload className="h-7 w-7" />
                    </div>
                    <h3 className="mt-5 text-sm font-extrabold text-[#2E2A25]">
                      Drag &amp; drop PDF here
                    </h3>
                    <p className="mt-2 text-xs text-[#6E6454]">
                      or click to browse your files
                    </p>
                    <div className="mt-6 text-[10px] font-bold tracking-wider uppercase text-[#8B7D6B]">
                      Limit 20MB • PDF Format
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Workspace */}
          {file && sessionId && (
            <div className="flex flex-col gap-8 flex-grow min-h-0 animate-in fade-in duration-500">
              
              {/* Minimalist Top Toolbar */}
              <div className="bg-white px-8 py-5 rounded-3xl border border-[#E5DEC9] shadow-[0_4px_20px_rgba(78,69,55,0.02)] flex flex-col gap-5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                  {/* Left: Document details */}
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-[#FAF7F2] text-[#4E4537] rounded-2xl border border-[#E5DEC9]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-bold text-[#2E2A25] truncate max-w-[200px] md:max-w-[450px]" title={file.name}>
                        {file.name}
                      </h2>
                      <p className="text-xs text-[#8B7D6B] font-semibold mt-1">
                        {pageCount} {pageCount === 1 ? "page" : "pages"} • {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {/* Right: The 3 Features in a Row */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
                    {/* Normal Summarizer Tab */}
                    <button
                      onClick={() => setActiveTab("normal")}
                      className={`flex items-center gap-2.5 px-4.5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        activeTab === "normal"
                          ? "bg-[#4E4537] text-white shadow-md"
                          : "hover:bg-[#FAF7F2] text-[#6E6454] hover:text-[#2E2A25] bg-white border border-[#E5DEC9]"
                      }`}
                    >
                      <BookOpen className="h-4.5 w-4.5" />
                      <span>Normal Summarizer</span>
                    </button>

                    {/* Keyword Summarizer Tab */}
                    <button
                      onClick={() => setActiveTab("keyword-summary")}
                      className={`flex items-center gap-2.5 px-4.5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        activeTab === "keyword-summary"
                          ? "bg-[#4E4537] text-white shadow-md"
                          : "hover:bg-[#FAF7F2] text-[#6E6454] hover:text-[#2E2A25] bg-white border border-[#E5DEC9]"
                      }`}
                    >
                      <Key className="h-4.5 w-4.5" />
                      <span>Keyword Summarizer</span>
                    </button>

                    {/* Keyword Search Tab */}
                    <button
                      onClick={() => setActiveTab("keyword-search")}
                      className={`flex items-center gap-2.5 px-4.5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        activeTab === "keyword-search"
                          ? "bg-[#4E4537] text-white shadow-md"
                          : "hover:bg-[#FAF7F2] text-[#6E6454] hover:text-[#2E2A25] bg-white border border-[#E5DEC9]"
                      }`}
                    >
                      <Search className="h-4.5 w-4.5" />
                      <span>Keyword Search</span>
                    </button>
                  </div>
                </div>

                {/* Secondary Row: Inputs for active tools */}
                {(activeTab === "keyword-summary" || activeTab === "keyword-search") && (
                  <div className="border-t border-[#E5DEC9] pt-4 flex justify-start md:justify-end">
                    {activeTab === "keyword-summary" && (
                      <form onSubmit={handleGenerateKeywordSummary} className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto animate-in fade-in slide-in-from-top-2 duration-250">
                        <span className="text-sm text-[#6E6454] font-bold">Summarize by keyword:</span>
                        <div className="flex gap-2.5 w-full sm:w-auto">
                          <input
                            type="text"
                            placeholder="e.g. Revenue, Security..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="px-4.5 py-2.5 text-sm rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] focus:outline-none focus:ring-1 focus:ring-[#4E4537] focus:border-[#4E4537] text-[#2E2A25] w-full sm:w-64"
                            required
                          />
                          <button
                            type="submit"
                            disabled={isLoadingResult || !keyword.trim()}
                            className="bg-[#4E4537] text-white rounded-2xl px-5 py-2.5 text-sm font-bold hover:bg-[#3D362B] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <span>Generate</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </form>
                    )}

                    {activeTab === "keyword-search" && (
                      <form onSubmit={handleKeywordSearch} className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto animate-in fade-in slide-in-from-top-2 duration-250">
                        <span className="text-sm text-[#6E6454] font-bold">Search phrase:</span>
                        <div className="flex gap-2.5 w-full sm:w-auto">
                          <input
                            type="text"
                            placeholder="Type a search phrase..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4.5 py-2.5 text-sm rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] focus:outline-none focus:ring-1 focus:ring-[#4E4537] focus:border-[#4E4537] text-[#2E2A25] w-full sm:w-64"
                            required
                          />
                          <button
                            type="submit"
                            disabled={isLoadingResult || !searchTerm.trim()}
                            className="bg-[#4E4537] text-white rounded-2xl px-5 py-2.5 text-sm font-bold hover:bg-[#3D362B] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <span>Search</span>
                            <Search className="h-4 w-4" />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Main Area: Split Screen (PDF preview left, Results Panel right) */}
              <div className="flex-grow flex flex-col md:flex-row gap-8 min-h-[550px]">
                
                {/* PDF Viewer Panel - Flex Increased to 1.4 for wider view */}
                <div className="flex-[1.4] flex flex-col bg-white border border-[#E5DEC9] rounded-3xl shadow-[0_4px_25px_rgba(78,69,55,0.02)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#E5DEC9] bg-[#FAF7F2]/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-5 w-5 text-[#8B7D6B]" />
                      <span className="text-sm font-bold text-[#2E2A25] truncate max-w-[200px] md:max-w-[400px]">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a 
                        href={pdfUrl || undefined} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 hover:bg-[#FAF7F2] rounded-xl text-[#8B7D6B] hover:text-[#2E2A25] transition-all"
                        title="Open PDF in new tab"
                      >
                        <Maximize2 className="h-4.5 w-4.5" />
                      </a>
                    </div>
                  </div>
                  <div className="flex-grow bg-[#FAF7F2]/20 relative min-h-[450px] md:min-h-0">
                    {pdfUrl ? (
                      <iframe
                        src={pdfUrl}
                        className="w-full h-full border-none"
                        title="PDF Preview"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8B7D6B]">
                        No PDF loaded.
                      </div>
                    )}
                  </div>
                </div>
              
                {/* Results / Summary Panel */}
                <div className="flex-grow flex-[1] flex flex-col bg-white border border-[#E5DEC9] rounded-3xl shadow-[0_4px_25px_rgba(78,69,55,0.02)] overflow-hidden">
                  
                  {/* Results Panel Header */}
                  <div className="px-6 py-4 border-b border-[#E5DEC9] bg-[#FAF7F2]/50 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8B7D6B]">
                      {activeTab === "normal" && "Normal Summary Output"}
                      {activeTab === "keyword-summary" && `Summary for: "${lastSummaryKeyword || "..."}"`}
                      {activeTab === "keyword-search" && `Search results for: "${lastSearchTerm || "..."}"`}
                    </h3>
                    
                    {/* Download Button */}
                    {((activeTab === "normal" && normalSummary) ||
                      (activeTab === "keyword-summary" && keywordSummary) ||
                      (activeTab === "keyword-search" && searchResults.length > 0)) && (
                      <button
                        onClick={handleDownloadResult}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#4E4537] hover:text-[#2E2A25] hover:bg-[#FAF7F2] bg-white border border-[#E5DEC9] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    )}
                  </div>
              
                  {/* Results Panel Content */}
                  <div className="flex-1 p-8 overflow-y-auto min-h-0 bg-white">
                    
                    {isLoadingResult ? (
                      <div className="h-full flex flex-col items-center justify-center py-16">
                        <HamsterLoader />
                        <p className="mt-5 text-sm text-[#6E6454] font-bold animate-pulse text-center">
                          {activeTab === "keyword-search" ? "Searching PDF pages..." : "Synthesizing text chunks with Gemini..."}
                        </p>
                      </div>
                    ) : (
                      <div className="h-full">
                        {/* Normal Summary Output */}
                        {activeTab === "normal" && (
                          normalSummary ? (
                            <div className="text-sm leading-relaxed text-[#2E2A25] font-sans">
                              {renderFormattedText(normalSummary)}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-16 animate-in fade-in duration-300">
                              <BookOpen className="h-10 w-10 text-[#DFD7C7] mb-4" />
                              <h4 className="text-sm font-bold text-[#2E2A25]">No Summary Generated</h4>
                              <p className="text-xs text-[#8B7D6B] max-w-[240px] mt-2 leading-relaxed">
                                Click the button below to summarize the entire document.
                              </p>
                              <button
                                onClick={handleGenerateNormalSummary}
                                className="mt-5 bg-[#4E4537] hover:bg-[#3D362B] text-white rounded-2xl px-5 py-3 text-sm font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                              >
                                Generate Full Summary
                              </button>
                            </div>
                          )
                        )}
              
                        {/* Keyword Summary Output */}
                        {activeTab === "keyword-summary" && (
                          keywordSummary ? (
                            <div className="text-sm leading-relaxed text-[#2E2A25] font-sans">
                              {renderFormattedText(keywordSummary)}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-16">
                              <Key className="h-10 w-10 text-[#DFD7C7] mb-4" />
                              <h4 className="text-sm font-bold text-[#2E2A25]">Keyword Summarizer</h4>
                              <p className="text-xs text-[#8B7D6B] max-w-[240px] mt-2 leading-relaxed">
                                Enter a keyword in the toolbar and click Generate to extract related points.
                              </p>
                            </div>
                          )
                        )}
              
                        {/* Keyword Search Output */}
                        {activeTab === "keyword-search" && (
                          searchResults.length > 0 ? (
                            <div className="space-y-4">
                              <div className="text-xs text-[#8B7D6B] font-bold uppercase tracking-wide pb-2 border-b border-[#E5DEC9]">
                                Found {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                              </div>
                              <ul className="space-y-3.5">
                                {searchResults.map((result, idx) => (
                                  <li 
                                    key={idx}
                                    className="p-4 bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl flex gap-4 text-sm hover:shadow-sm transition-all"
                                  >
                                    <div className="h-6 px-2 bg-white border border-[#E5DEC9] text-[#2E2A25] font-extrabold rounded-lg flex items-center justify-center text-[10px] flex-shrink-0">
                                      Page {result.page}
                                    </div>
                                    <div className="text-[#6E6454] italic leading-relaxed text-sm">
                                      &ldquo;{highlightMatches(result.text, lastSearchTerm)}&rdquo;
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-16">
                              <Search className="h-10 w-10 text-[#DFD7C7] mb-4" />
                              <h4 className="text-sm font-bold text-[#2E2A25]">
                                {lastSearchTerm ? "No Matches Found" : "Keyword Search"}
                              </h4>
                              <p className="text-xs text-[#8B7D6B] max-w-[240px] mt-2 leading-relaxed">
                                {lastSearchTerm 
                                  ? `No occurrences of "${lastSearchTerm}" were found in this document.` 
                                  : "Type a search phrase in the toolbar to retrieve all containing sentences."}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}
              
                  </div>
                </div>
              </div>

              {/* Chat Panel Section */}
              <div className="bg-white border border-[#E5DEC9] rounded-3xl shadow-[0_6px_30px_rgba(78,69,55,0.03)] overflow-hidden flex flex-col min-h-[550px] max-h-[650px] mt-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {/* Chat Header */}
                <div className="px-6 py-4.5 border-b border-[#E5DEC9] bg-[#FAF7F2]/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-[#8B7D6B]" />
                    <span className="text-sm font-bold text-[#2E2A25] uppercase tracking-wider">
                      Chat with PDF & Form Assistant
                    </span>
                    {hasFormFields && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/60 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Fillable Form Fields Detected
                      </span>
                    )}
                  </div>
                  {hasFormFields && (
                    <button
                      onClick={handleDownloadFilledPDF}
                      disabled={isDownloadingForm}
                      className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isDownloadingForm ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download Filled PDF
                    </button>
                  )}
                </div>

                {/* Message List */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4.5 bg-[#FAF7F2]/45">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-16 animate-in fade-in duration-300">
                      <div className="p-4 bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl text-[#8B7D6B] mb-4">
                        <MessageSquare className="h-7 w-7" />
                      </div>
                      <h4 className="text-sm font-bold text-[#2E2A25]">Start a Conversation</h4>
                      <p className="text-xs text-[#8B7D6B] max-w-[320px] mt-2 leading-relaxed">
                        {hasFormFields 
                          ? "This PDF has fillable form fields. Type 'fill the form' or provide values conversationally to fill them."
                          : "Ask questions, get explanations, or request specific sections to be extracted."}
                      </p>
                    </div>
                  ) : (
                    chatHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm transition-all animate-in duration-300 ${
                            msg.role === "user"
                              ? "bg-[#4E4537] text-[#FAF7F0] font-medium rounded-tr-none slide-in-from-right-4"
                              : "bg-white text-[#2E2A25] border border-[#E5DEC9] rounded-tl-none slide-in-from-left-4"
                          }`}
                        >
                          <div className="font-sans whitespace-pre-line">
                            {msg.role === "assistant" ? renderFormattedText(msg.content) : msg.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isChatThinking && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-[#E5DEC9] rounded-2xl rounded-tl-none px-5 py-3.5 text-sm text-[#6E6454] shadow-sm flex items-center gap-2 font-medium italic animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin text-[#8B7D6B]" />
                        Serea is thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendMessage} className="p-5 border-t border-[#E5DEC9] bg-white flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask Serea about the PDF or request to fill form..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-grow px-5 py-3.5 text-sm rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] focus:outline-none focus:ring-1 focus:ring-[#4E4537] focus:border-[#4E4537] text-[#2E2A25] transition-all"
                    disabled={isChatThinking}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatThinking}
                    className="bg-[#4E4537] text-white rounded-2xl px-5 py-3.5 text-sm font-bold hover:bg-[#3D362B] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Send</span>
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Decorative footer */}
      <footer className="py-5 text-center text-xs font-semibold text-[#8B7D6B] border-t border-[#E5DEC9] bg-white shadow-[0_-2px_8px_rgba(78,69,55,0.01)]">
        SEREA Summarizer Tool • local demo in-memory session
      </footer>
    </div>
  );
}
