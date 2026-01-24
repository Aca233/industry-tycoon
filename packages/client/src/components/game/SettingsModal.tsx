/**
 * Settings Modal - 游戏设置弹窗
 * 包含 LLM API 配置和音效设置
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { AudioSettingsPanel } from './AudioSettingsPanel';
import { useUISound } from '../../audio';

// 设置标签类型
type SettingsTab = 'audio' | 'llm';

interface SettingsModalProps {
  onClose: () => void;
  defaultTab?: SettingsTab;
}

export function SettingsModal({ onClose, defaultTab = 'audio' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { playPanelClose, playTabSwitch } = useUISound();

  // Load current config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getLLMConfig();
      if (result.error) {
        setError(result.error);
      } else {
        setApiKey(result.data.apiKey || '');
        setBaseUrl(result.data.baseUrl || '');
        setModel(result.data.model || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      const config: { apiKey?: string; baseUrl?: string; model?: string } = {};
      
      // Only send non-empty values, and only send apiKey if it's not masked
      if (apiKey && !apiKey.includes('****')) {
        config.apiKey = apiKey;
      }
      if (baseUrl) {
        config.baseUrl = baseUrl;
      }
      if (model) {
        config.model = model;
      }
      
      const result = await api.updateLLMConfig(config);
      if (result.error) {
        setError(result.error);
      } else {
        setTestResult({ success: true, message: '配置已保存！' });
        // Update local state with returned config
        setApiKey(result.data.config.apiKey || '');
        setBaseUrl(result.data.config.baseUrl || '');
        setModel(result.data.config.model || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 构建临时配置（用于测试和获取模型，不保存）
  const buildTempConfig = () => {
    const config: { apiKey?: string; baseUrl?: string; model?: string } = {};
    // 如果apiKey不是掩码格式，则使用当前输入的值
    if (apiKey && !apiKey.includes('****')) {
      config.apiKey = apiKey;
    }
    if (baseUrl) {
      config.baseUrl = baseUrl;
    }
    if (model) {
      config.model = model;
    }
    return config;
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    
    // 客户端超时控制
    const timeoutId = setTimeout(() => {
      setTesting(false);
      setTestResult({ success: false, message: '请求超时，请检查网络连接或API配置' });
    }, 20000); // 20秒超时
    
    try {
      // 使用临时配置测试（不保存）
      const tempConfig = buildTempConfig();
      const result = await api.testLLMConnectionTemp(tempConfig);
      clearTimeout(timeoutId);
      if (result.error) {
        setTestResult({ success: false, message: result.error });
      } else {
        setTestResult(result.data);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      setTestResult({ success: false, message: err instanceof Error ? err.message : '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadModels = async () => {
    setLoadingModels(true);
    setError(null);
    
    // 客户端超时控制
    const timeoutId = setTimeout(() => {
      setLoadingModels(false);
      setError('获取模型列表超时');
    }, 15000);
    
    try {
      // 使用临时配置获取模型列表（不保存）
      const tempConfig = buildTempConfig();
      const result = await api.getAvailableModelsTemp(tempConfig);
      clearTimeout(timeoutId);
      if (result.error) {
        setError(result.error);
      } else if (result.data.success) {
        setAvailableModels(result.data.models);
        if (result.data.models.length === 0) {
          setError('未找到可用模型，请检查API配置');
        }
      } else {
        setError(result.data.message || '获取模型列表失败');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      setError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      playPanelClose();
      onClose();
    }
  }, [onClose, playPanelClose]);

  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose, playPanelClose]);

  const handleTabChange = useCallback((tab: SettingsTab) => {
    if (tab !== activeTab) {
      playTabSwitch();
      setActiveTab(tab);
    }
  }, [activeTab, playTabSwitch]);

  // 标签配置
  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'audio', label: '音效设置', icon: '🔊' },
    { id: 'llm', label: 'AI 设置', icon: '🤖' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 rounded-xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚙️</span>
            <span>游戏设置</span>
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-700/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/20'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Audio Settings Tab */}
          {activeTab === 'audio' && (
            <AudioSettingsPanel />
          )}

          {/* LLM Settings Tab */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-400">加载配置中...</p>
            </div>
          ) : (
            <>
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  输入新的API Key将覆盖现有配置。留空则保持不变。
                </p>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持OpenAI官方API或兼容的第三方API（如中转站）
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  模型名称
                </label>
                <div className="flex gap-2">
                  {availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    >
                      <option value="">选择模型...</option>
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  )}
                  <button
                    onClick={handleLoadModels}
                    disabled={loadingModels || (!apiKey || apiKey.includes('****')) && !baseUrl}
                    className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="使用当前配置获取可用模型列表（无需保存）"
                  >
                    {loadingModels ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <span>🔄</span>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {availableModels.length > 0
                    ? `已加载 ${availableModels.length} 个模型`
                    : '输入API Key后点击🔄获取模型列表（无需先保存）'}
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
                  ❌ {error}
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? 'bg-green-900/30 border border-green-700/50 text-green-400' 
                    : 'bg-red-900/30 border border-red-700/50 text-red-400'
                }`}>
                  {testResult.success ? '✅' : '❌'} {testResult.message}
                </div>
              )}
            </>
              )}
            </div>
          )}
        </div>

        {/* Footer - Only show for LLM tab */}
        {activeTab === 'llm' && (
          <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={handleTest}
              disabled={loading || testing}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>测试中...</span>
                </>
              ) : (
                <>
                  <span>🔌</span>
                  <span>测试连接</span>
                </>
              )}
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading || saving}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>保存中...</span>
                </>
              ) : (
                  <>
                    <span>💾</span>
                    <span>保存配置</span>
                  </>
                )}
                </button>
              </div>
          </div>
        )}

        {/* Footer for Audio tab */}
        {activeTab === 'audio' && (
          <div className="flex items-center justify-end p-4 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
            >
              <span>✓</span>
              <span>完成</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}