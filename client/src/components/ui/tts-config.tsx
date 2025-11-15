import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Settings, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TTSConfigProps {
  onConfigured: () => void;
}

export function TTSConfig({ onConfigured }: TTSConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCredentials(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSave = async () => {
    if (!credentials.trim()) {
      toast({
        title: "Error",
        description: "Please provide Google TTS credentials",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Validate JSON format
      const credentialsObj = JSON.parse(credentials);
      
      // Check required fields
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !credentialsObj[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Save to localStorage
      localStorage.setItem('googleTTSCredentials', credentials);
      
      // Send to server to initialize TTS client
      const response = await fetch('/api/configure-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credentials: credentialsObj }),
      });

      if (!response.ok) {
        throw new Error(`Configuration failed: ${response.status}`);
      }

      setIsConfigured(true);
      toast({
        title: "Success",
        description: "Google TTS configured successfully",
      });
      
      onConfigured();
      setIsOpen(false);
    } catch (error) {
      console.error('TTS Configuration Error:', error);
      toast({
        title: "Configuration Error",
        description: error instanceof Error ? error.message : "Invalid credentials format",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('googleTTSCredentials');
    setCredentials('');
    setIsConfigured(false);
    toast({
      title: "Cleared",
      description: "TTS configuration cleared",
    });
  };

  const checkExistingConfig = () => {
    const existing = localStorage.getItem('googleTTSCredentials');
    if (existing) {
      setCredentials(existing);
      setIsConfigured(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    checkExistingConfig();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            checkExistingConfig();
            setIsOpen(true);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          {isConfigured ? 'Reconfigure TTS' : 'Configure TTS'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Google Text-to-Speech Configuration</DialogTitle>
          <DialogDescription>
            To use text-to-speech features, provide your Google Cloud service account credentials.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credentials">Service Account JSON</Label>
            <div className="space-y-2">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload JSON File
                </Button>
                {isConfigured && (
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear Configuration
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="credentials"
              placeholder="Or paste your service account JSON here..."
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Required JSON Structure</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs overflow-x-auto">
{`{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "service-account@project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "...",
  "universe_domain": "googleapis.com"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isLoading || !credentials.trim()}
            >
              {isLoading ? "Configuring..." : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}