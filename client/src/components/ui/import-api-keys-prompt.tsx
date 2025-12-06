/**
 * Import API Keys Prompt Component
 * Displays a prompt to import API keys when they're missing
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Key, Settings, AlertCircle } from 'lucide-react';
import { useAPIKeys } from '@/lib/api-keys-context';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { APIKeysSettings } from './api-keys-settings';

interface ImportAPIKeysPromptProps {
  keyType: 'mistral' | 'gemini' | 'any';
  featureName?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Shows a prompt to import API keys when they're missing
 * Can be used inline (compact mode) or as a full card
 */
export function ImportAPIKeysPrompt({ 
  keyType, 
  featureName = 'this feature',
  compact = false,
  className = ''
}: ImportAPIKeysPromptProps) {
  const { importKeysFromFile, isImportDialogOpen, openImportDialog, closeImportDialog, refreshKeys } = useAPIKeys();
  const { toast } = useToast();

  const keyName = keyType === 'mistral' ? 'Mistral AI' : keyType === 'gemini' ? 'Gemini AI' : 'API';

  const handleImport = async () => {
    const success = await importKeysFromFile();
    if (success) {
      toast({
        title: "✅ API Keys Imported",
        description: "Your API keys have been imported successfully. You can now use all features!",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Failed to import API keys. Please check the file format.",
      });
    }
  };

  if (compact) {
    return (
      <div className={`flex flex-col items-center gap-3 p-4 ${className}`}>
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Key Required</AlertTitle>
          <AlertDescription>
            {keyName} key is needed for {featureName}. Import your keys to continue.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2 w-full">
          <Button onClick={handleImport} variant="default" className="flex-1">
            <Upload className="mr-2 h-4 w-4" />
            Import Keys
          </Button>
          <Button onClick={openImportDialog} variant="outline" className="flex-1">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
        
        {/* Settings Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={(open) => open ? openImportDialog() : closeImportDialog()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>API Keys Settings</DialogTitle>
              <DialogDescription>
                Configure your API keys to enable AI-powered features
              </DialogDescription>
            </DialogHeader>
            <APIKeysSettings />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-amber-100 dark:bg-amber-900/20 w-fit">
          <Key className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <CardTitle>API Keys Required</CardTitle>
        <CardDescription>
          {keyName} key is needed to use {featureName}. Your keys may have been cleared by browser storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your API keys are stored locally and may be cleared by:
            <ul className="list-disc list-inside mt-2 text-sm">
              <li>Clearing browser data or cookies</li>
              <li>Using private/incognito mode</li>
              <li>Browser storage cleanup</li>
            </ul>
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-col gap-2">
          <Button onClick={handleImport} className="w-full" size="lg">
            <Upload className="mr-2 h-5 w-5" />
            Import API Keys
          </Button>
          <Button onClick={openImportDialog} variant="outline" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            Open Settings
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Don't have keys? Visit{' '}
          {keyType === 'mistral' ? (
            <a href="https://console.mistral.ai/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Mistral AI Console
            </a>
          ) : keyType === 'gemini' ? (
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Google AI Studio
            </a>
          ) : (
            <span>the respective AI platform consoles</span>
          )}{' '}
          to get your API key.
        </p>
      </CardContent>
      
      {/* Settings Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => open ? openImportDialog() : closeImportDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Keys Settings</DialogTitle>
            <DialogDescription>
              Configure your API keys to enable AI-powered features
            </DialogDescription>
          </DialogHeader>
          <APIKeysSettings />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Button that shows "Import API Keys" when keys are missing,
 * otherwise renders children or default button
 */
interface APIKeyRequiredButtonProps {
  keyType: 'mistral' | 'gemini';
  children: React.ReactNode;
  fallbackText?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function APIKeyRequiredButton({
  keyType,
  children,
  fallbackText = 'Import API Keys',
  onClick,
  disabled,
  className,
  variant = 'default',
  size = 'default',
}: APIKeyRequiredButtonProps) {
  const { hasMistralKey, hasGeminiKey, importKeysFromFile } = useAPIKeys();
  const { toast } = useToast();
  
  const hasKey = keyType === 'mistral' ? hasMistralKey : hasGeminiKey;

  const handleImport = async () => {
    const success = await importKeysFromFile();
    if (success) {
      toast({
        title: "✅ API Keys Imported",
        description: "Your API keys have been imported. Try your action again!",
      });
    }
  };

  if (!hasKey) {
    return (
      <Button 
        onClick={handleImport}
        variant="outline"
        size={size}
        className={`border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 ${className}`}
      >
        <Upload className="mr-2 h-4 w-4" />
        {fallbackText}
      </Button>
    );
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={className}
    >
      {children}
    </Button>
  );
}

