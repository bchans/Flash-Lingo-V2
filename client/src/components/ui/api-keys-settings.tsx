import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Download, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAPIKeys, saveAPIKeys, exportAPIKeys, importAPIKeys, type APIKeys } from '@/lib/api-keys';
import { initializeFirebase } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export function APIKeysSettings() {
  const [keys, setKeys] = useState<APIKeys>({
    geminiApiKey: '',
    firebaseApiKey: '',
    mistralApiKey: ''
  });
  const [showKeys, setShowKeys] = useState({
    gemini: false,
    firebase: false,
    mistral: false
  });
  const [saved, setSaved] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadedKeys = getAPIKeys();
    setKeys(loadedKeys);
  }, []);

  const handleSave = () => {
    try {
      saveAPIKeys(keys);
      // Reinitialize Firebase if config changed
      if (keys.firebaseConfig) {
        initializeFirebase();
      }
      setSaved(true);
      toast({
        title: "API Keys Saved",
        description: "Your API keys have been saved successfully.",
      });
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API keys.",
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    try {
      const exported = exportAPIKeys();
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flashlingo-api-keys.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "API Keys Exported",
        description: "Your API keys have been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export API keys.",
        variant: "destructive"
      });
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          importAPIKeys(text);
          const loadedKeys = getAPIKeys();
          setKeys(loadedKeys);
          // Reinitialize Firebase if config was imported
          if (loadedKeys.firebaseConfig) {
            console.log('🔄 Reinitializing Firebase with imported config...');
            initializeFirebase();
          }
          toast({
            title: "API Keys Imported",
            description: "Your API keys have been imported successfully.",
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to import API keys. Make sure the file is valid.",
            variant: "destructive"
          });
        }
      }
    };
    input.click();
  };

  const toggleShowKey = (keyType: 'gemini' | 'firebase' | 'mistral') => {
    setShowKeys(prev => ({ ...prev, [keyType]: !prev[keyType] }));
  };

  const handleCheckForUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      toast({
        title: "Not Supported",
        description: "Service workers are not supported in this browser.",
        variant: "destructive"
      });
      return;
    }

    setIsCheckingUpdate(true);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      
      // Check if there's a new service worker waiting or installing
      if (registration.waiting) {
        toast({
          title: "Update Available!",
          description: "A new version is ready. Reloading to apply update...",
        });
        // Tell the waiting SW to skip waiting and activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Reload after a short delay
        setTimeout(() => window.location.reload(), 1000);
      } else if (registration.installing) {
        toast({
          title: "Update Installing",
          description: "A new version is being installed. Please wait...",
        });
        // Wait for installation to complete then reload
        registration.installing.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'installed') {
            setTimeout(() => window.location.reload(), 1000);
          }
        });
      } else {
        toast({
          title: "Up to Date",
          description: "You're running the latest version of FlashLingo!",
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
      toast({
        title: "Update Check Failed",
        description: "Could not check for updates. Make sure you're online.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
          <AlertDescription>
            🔒 <strong>Privacy:</strong> All API keys are stored only on your device in local storage.
            You can export and import them between devices.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="gemini" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gemini">Gemini AI</TabsTrigger>
            <TabsTrigger value="firebase">Firebase</TabsTrigger>
            <TabsTrigger value="mistral">Mistral AI</TabsTrigger>
          </TabsList>

          <TabsContent value="gemini" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="gemini-key"
                  type={showKeys.gemini ? 'text' : 'password'}
                  placeholder="AIza..."
                  value={keys.geminiApiKey}
                  onChange={(e) => setKeys({ ...keys, geminiApiKey: e.target.value })}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleShowKey('gemini')}
                >
                  {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="firebase" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firebase-key">Firebase API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="firebase-key"
                  type={showKeys.firebase ? 'text' : 'password'}
                  placeholder="AIza..."
                  value={keys.firebaseApiKey}
                  onChange={(e) => setKeys({ ...keys, firebaseApiKey: e.target.value })}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleShowKey('firebase')}
                >
                  {showKeys.firebase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Firebase Console
                </a>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="mistral" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mistral-key">Mistral API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="mistral-key"
                  type={showKeys.mistral ? 'text' : 'password'}
                  placeholder="..."
                  value={keys.mistralApiKey}
                  onChange={(e) => setKeys({ ...keys, mistralApiKey: e.target.value })}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleShowKey('mistral')}
                >
                  {showKeys.mistral ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://console.mistral.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Mistral AI Console
                </a>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSave} className="flex-1">
            {saved ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              'Save API Keys'
            )}
          </Button>
          <Button onClick={handleExport} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleImport} variant="outline" className="flex-1">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Note:</strong> When you export your cards, API keys will also be included.
            This allows you to restore everything on a new device.
          </AlertDescription>
        </Alert>

        {/* App Update Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">App Updates</h4>
              <p className="text-sm text-muted-foreground">
                Check for and install the latest version
              </p>
            </div>
            <Button 
              onClick={handleCheckForUpdate} 
              variant="outline"
              disabled={isCheckingUpdate}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
            </Button>
          </div>
        </div>
    </div>
  );
}

