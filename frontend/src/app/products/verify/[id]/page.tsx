'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getProductById, verifyProductQuality } from '@/lib/api/products';
import { Product, ProductStatus } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';

// Web3 background animation component
function Web3Background() {
  const [particles, setParticles] = useState<Array<{
    left: string;
    top: string;
    width: string;
    height: string;
    animationDelay: string;
    animationDuration: string;
  }>>([]);

  // Generate particles only on client-side to avoid hydration mismatch
  useEffect(() => {
    const newParticles = Array(30).fill(0).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${Math.random() * 8 + 4}px`,
      height: `${Math.random() * 8 + 4}px`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${Math.random() * 10 + 10}s`
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#18122B] via-[#232526] to-[#0f2027] animate-gradient-move overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle, i) => (
          <div
            key={`particle-${i}`}
            className="absolute rounded-full opacity-20 animate-float"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.width,
              height: particle.height,
              background: `linear-gradient(135deg, #a259ff, #00ffcc, #00bfff)`,
              animationDelay: particle.animationDelay,
              animationDuration: particle.animationDuration
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function VerifyProductPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [qualityScore, setQualityScore] = useState<number>(90);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [alreadyVerified, setAlreadyVerified] = useState<boolean>(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const fetchedProduct = await getProductById(productId);
        setProduct(fetchedProduct);
        
        // Check if product is already verified
        if (fetchedProduct?.status?.toUpperCase() === ProductStatus.VERIFIED) {
          setAlreadyVerified(true);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setError('Could not load product details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Check if user is authorized to verify this product
  const isAuthorized = session?.user?.id === product?.ownerId;

  const handleVerifyProduct = async () => {
    if (!product) return;
    
    try {
      setIsVerifying(true);
      setError(null);
      
      // Create verification data object
      const verificationData = {
        qualityScore,
        qualityChecks: ["visual"],
        requiredAttributes: ["qualityScore"],
        minimumStandards: {
          qualityScore: 90
        }
      };
      
      // Call verification API
      await verifyProductQuality(productId, verificationData);
      
      // Show success message and redirect after a delay
      setSuccess(true);
      
      // Wait 2 seconds and redirect to product details
      setTimeout(() => {
        router.push(`/products/${productId}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error verifying product:', error);
      
      // Check if the error indicates product is already verified
      // Handle different error formats that might come from Axios
      if (
        error.response?.status === 403 || 
        error.response?.data?.code === 'USER_ALREADY_VERIFIED' ||
        error.response?.data?.message?.includes('sudah memverifikasi') ||
        error.message?.includes('USER_ALREADY_VERIFIED') ||
        error.message?.includes('sudah memverifikasi')
      ) {
        console.log('User has already verified this product');
        setAlreadyVerified(true);
      } else {
        setError('Failed to verify product. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQualityScoreChange = (value: number[]) => {
    setQualityScore(value[0]);
  };

  return (
    <div className="min-h-screen pb-10">
      <Web3Background />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-[#a259ff] hover:text-[#00ffcc] transition-colors mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>
          
          <h1 className="text-4xl font-bold font-orbitron bg-gradient-to-r from-[#a259ff] via-[#00ffcc] to-[#00bfff] bg-clip-text text-transparent drop-shadow-[0_0_20px_#00ffcc] animate-glow">
            Verify Product
          </h1>
          <p className="text-gray-300 mt-2 font-space">
            Assess and verify product quality before accepting it
          </p>
        </div>

        {error && !alreadyVerified && (
          <div className="bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}
        
        {alreadyVerified && (
          <div className="bg-green-900/30 border-l-4 border-green-500 p-4 mb-6 rounded-lg">
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
              <p className="text-green-200">Product Already Verified</p>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-900/30 border-l-4 border-green-500 p-4 mb-6 rounded-lg animate-pulse">
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
              <p className="text-green-200">Product verified successfully! Redirecting...</p>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-10 w-10 text-[#a259ff] animate-spin" />
          </div>
        ) : !product ? (
          <div className="bg-slate-800/40 rounded-xl p-10 text-center">
            <h3 className="text-xl text-gray-300 font-space mb-6">Product not found</h3>
            <Link href="/my-products">
              <Button className="bg-gradient-to-r from-[#a259ff] to-[#00ffcc] hover:opacity-90 text-black font-bold">
                Go to My Products
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            {/* Quality Score History */}
            {product?.metadata?.qualityScoreHistory && (
              <div className="mb-6 bg-[#18122B] rounded-xl p-4 border border-[#00bfff]">
                <h3 className="text-lg font-orbitron text-[#00bfff] mb-3">Quality Score History</h3>
                <div className="space-y-2">
                  {(() => {
                    let historyData;
                    
                    // Try to parse if it's a string
                    if (typeof product.metadata.qualityScoreHistory === 'string') {
                      try {
                        historyData = JSON.parse(product.metadata.qualityScoreHistory);
                      } catch (e) {
                        return <p className="text-gray-400">No history available</p>;
                      }
                    } else if (Array.isArray(product.metadata.qualityScoreHistory)) {
                      historyData = product.metadata.qualityScoreHistory;
                    } else {
                      return <p className="text-gray-400">No history available</p>;
                    }
                    
                    if (!historyData || historyData.length === 0) {
                      return <p className="text-gray-400">No history available</p>;
                    }
                    
                    // Sort history entries by timestamp if available
                    const sortedHistory = [...historyData].sort((a, b) => {
                      // Try to sort by timestamp if available
                      if (a.timestamp && b.timestamp) {
                        return b.timestamp - a.timestamp;  // newest first
                      }
                      return 0;  // maintain original order if no timestamp
                    });
                    
                    return sortedHistory.map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-[#00ffcc] font-bold font-orbitron">
                          {entry.role || 'UNKNOWN'} <span className="text-white">›</span>
                        </span>
                        <span className="text-white font-bold">
                          {entry.score || 0}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
            
            {/* Simplified - Quality Assessment Card */}
            <Card className="bg-gradient-to-br from-[#232526cc] to-[#18122Bcc] border-2 border-[#00ffcc] p-6 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-6 font-orbitron">Quality Assessment</h2>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="quality-score" className="text-white font-medium">Quality Score</Label>
                    <span className="text-2xl font-bold text-[#00ffcc]">{qualityScore}/100</span>
                  </div>
                  
                  <div className="pb-4">
                    <Slider
                      defaultValue={[qualityScore]}
                      max={100}
                      min={0}
                      step={1}
                      onValueChange={handleQualityScoreChange}
                      className="w-full"
                      disabled={alreadyVerified}
                    />
                    
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Poor</span>
                      <span>Average</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button
                    onClick={handleVerifyProduct}
                    disabled={isVerifying || success || !isAuthorized || alreadyVerified}
                    className="w-full bg-gradient-to-r from-[#00ffcc] to-[#00bfff] hover:opacity-90 text-black font-bold py-3 h-auto text-lg"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : alreadyVerified ? (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Already Verified
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Verify Product
                      </>
                    )}
                  </Button>
                  
                  {!isAuthorized && !alreadyVerified && (
                    <p className="text-red-400 text-sm mt-2 text-center">
                      You are not authorized to verify this product
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 