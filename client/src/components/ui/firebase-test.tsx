import { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { testFirebaseConnection, getMistralTranslation, getGeminiResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function FirebaseTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<{
    connection: boolean | null;
    mistral: string | null;
    gemini: string | null;
  }>({
    connection: null,
    mistral: null,
    gemini: null,
  });
  const { toast } = useToast();

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const result = await testFirebaseConnection();
      setTestResults(prev => ({ ...prev, connection: result }));
      toast({
        title: result ? 'Firebase Connection Successful' : 'Firebase Connection Failed',
        description: result ? 'Connected to Firebase Functions' : 'Unable to connect to Firebase Functions',
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, connection: false }));
      toast({
        title: 'Connection Error',
        description: 'Failed to test Firebase connection',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testMistral = async () => {
    setIsLoading(true);
    try {
      const result = await getMistralTranslation('Hello', 'en', 'es');
      setTestResults(prev => ({ ...prev, mistral: result }));
      toast({
        title: 'Mistral Translation Success',
        description: `Translation: ${result}`,
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, mistral: `Error: ${error}` }));
      toast({
        title: 'Mistral Translation Failed',
        description: 'Unable to get translation from Mistral',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testGemini = async () => {
    setIsLoading(true);
    try {
      const result = await getGeminiResponse('Say hello in Spanish');
      setTestResults(prev => ({ ...prev, gemini: result }));
      toast({
        title: 'Gemini Response Success',
        description: `Response: ${result}`,
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, gemini: `Error: ${error}` }));
      toast({
        title: 'Gemini Response Failed',
        description: 'Unable to get response from Gemini',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Firebase Functions Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <Button
            onClick={testConnection}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </Button>
          {testResults.connection !== null && (
            <div className={`text-sm ${testResults.connection ? 'text-green-600' : 'text-red-600'}`}>
              Connection: {testResults.connection ? 'Success' : 'Failed'}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <Button
            onClick={testMistral}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Mistral Translation'}
          </Button>
          {testResults.mistral && (
            <div className="text-sm text-blue-600">
              Mistral: {testResults.mistral}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <Button
            onClick={testGemini}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Gemini Response'}
          </Button>
          {testResults.gemini && (
            <div className="text-sm text-purple-600">
              Gemini: {testResults.gemini}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}