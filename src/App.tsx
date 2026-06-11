import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

// 将 Vite BASE_URL 转换为 React Router 可用的 basename
// e.g. '/repo-name/' → '/repo-name'，'./' → ''
function getBasename(): string {
  const b = import.meta.env.BASE_URL;
  if (b.startsWith('/') && b.length > 1) return b.replace(/\/$/, '');
  return '';
}

export default function App() {
  return (
    <Router basename={getBasename()}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
