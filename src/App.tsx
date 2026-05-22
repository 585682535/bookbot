import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { BookingForm } from './components/BookingForm';
import CRMDashboard from './components/CRMDashboard';
import CRMCalendar from './components/CRMCalendar';
import BookingsList from './components/BookingsList';
import ServicesManager from './components/ServicesManager';
import StaffManager from './components/StaffManager';
import ClientsDatabase from './components/ClientsDatabase';
import BusinessSettings from './components/BusinessSettings';
import DashboardLayout from './components/DashboardLayout';
import { Chatbot } from './components/Chatbot';
import { Button, buttonVariants } from '@/components/ui/button';
import { LayoutDashboard, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import BookingConfirmation from './pages/BookingConfirmation';
import BookingCancellation from './pages/BookingCancellation';
import WaitlistClaim from './pages/WaitlistClaim';

import InstagramLanding from './pages/InstagramLanding';
import ReviewPage from './pages/ReviewPage';
import PromocodesManager from './components/PromocodesManager';
import ReviewsManager from './components/ReviewsManager';
import ClientProfile from './components/ClientProfile';
import RebookPage from './pages/RebookPage';
import HomePage from './pages/HomePage';
import BusinessFeedPage from './pages/BusinessFeedPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { PostsFeed } from './components/PostsFeed';
import BusinessSetup from './pages/BusinessSetup';
import OnboardingPage from './pages/OnboardingPage';
import axios from 'axios';

function DashboardRedirect() {
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkBusiness = async () => {
      const ownerToken = localStorage.getItem('ownerToken');
      const clientToken = localStorage.getItem('clientToken');
      const userRole = localStorage.getItem('userRole');
      
      console.log('DashboardRedirect - State:', { 
        hasOwnerToken: !!ownerToken, 
        ownerTokenStart: ownerToken ? ownerToken.substring(0, 15) + '...' : 'none',
        hasClientToken: !!clientToken, 
        userRole 
      });

      // Если роль - клиент, отправляем в профиль
      if (userRole === 'client') {
        console.log('User is client, redirecting to /profile');
        navigate('/profile');
        return;
      }

      const token = ownerToken;
      if (!token) {
        console.log('No owner token found, redirecting to home');
        navigate('/');
        return;
      }

      try {
        console.log('Fetching business data for owner with token:', token.substring(0, 15) + '...');
        const res = await axios.get('/api/businesses/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Business data received in DashboardRedirect:', JSON.stringify(res.data));

        if (res.data && res.data.slug) {
          const business = res.data;
          console.log('Business found, slug:', business.slug, 'isPublished:', business.isPublished);
          // Если бизнес уже опубликован, всегда отправляем в дашборд
          if (business.isPublished === true) {
            console.log('Business is published, redirecting to dashboard:', business.slug);
            navigate(`/dashboard/${business.slug}`);
            return;
          }

          // Если не опубликован, проверяем заполненность основных полей
          const isBasicInfoComplete = !!(business.name && business.address && business.industry);
          console.log('Checking basic info completeness:', { 
            name: !!business.name, 
            address: !!business.address, 
            industry: !!business.industry,
            isComplete: isBasicInfoComplete 
          });
          
          if (isBasicInfoComplete) {
            console.log('Basic info complete, redirecting to dashboard:', business.slug);
            navigate(`/dashboard/${business.slug}`);
          } else {
            console.log('Basic info incomplete, redirecting to onboarding');
            navigate('/onboarding');
          }
        } else {
          console.log('No business found for this owner account (res.data.slug is missing), redirecting to setup');
          navigate('/setup');
        }
      } catch (error: any) {
        console.error('Dashboard redirect error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        if (error.response?.status === 404) {
          console.log('Business not found (404) in DashboardRedirect, redirecting to setup');
          navigate('/setup');
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('Auth error (401/403) in DashboardRedirect, clearing tokens and redirecting to home');
          localStorage.removeItem('ownerToken');
          localStorage.removeItem('userRole');
          navigate('/');
        } else {
          console.log('Unexpected error in DashboardRedirect, staying on current page or fallback to home');
          toast.error('Ошибка при загрузке данных бизнеса. Попробуйте обновить страницу.');
          setLoading(false);
        }
      }
    };

    checkBusiness();
  }, [navigate]);

  if (loading) return <div className="flex justify-center p-20">Загрузка дашборда...</div>;
  return null;
}

function AuthSuccess() {
  const [searchParams] = React.useMemo(() => [new URLSearchParams(window.location.search)], []);
  React.useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('clientToken', token);
      window.location.href = '/profile';
    }
  }, [searchParams]);
  return <div className="flex justify-center p-20">Авторизация...</div>;
}

function ReferralRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchReferral = async () => {
      try {
        const res = await axios.get(`/api/referral/${code}`);
        const { business } = res.data;
        navigate(`/book/${business.slug}?ref=${code}`);
      } catch (e) {
        navigate('/');
      }
    };
    if (code) fetchReferral();
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl text-center space-y-4 max-w-sm w-full border border-slate-100">
        <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto animate-pulse">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Готовим вашу скидку...</h2>
        <p className="text-slate-500 text-sm">Перенаправляем на страницу бронирования по рекомендации</p>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto opacity-20" />
      </div>
    </div>
  );
}

function BookingPage() {
  const { slug } = useParams();
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              B
            </div>
            <span className="text-xl font-bold tracking-tight">BookBot</span>
          </a>
        </div>
        <BookingForm slug={slug || 'barber-studio'} />
      </div>
      <Chatbot />
    </div>
  );
}

function PostsFeedWrapper() {
  const { slug } = useParams();
  const [business, setBusiness] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await axios.get(`/api/businesses/${slug}`);
        setBusiness(res.data);
      } catch (e) {}
    };
    fetchBusiness();
  }, [slug]);

  if (!business) return null;
  return <div className="p-8"><PostsFeed businessSlug={business.slug} businessId={business.id} /></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MarketplacePage />} />
        <Route path="/catalog" element={<MarketplacePage />} />
        <Route path="/ref/:code" element={<ReferralRedirect />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/b/:slug/feed" element={<BusinessFeedPage />} />
        
        {/* Public Action Routes */}
        <Route path="/b/:hash/confirm" element={<BookingConfirmation />} />
        <Route path="/b/:hash/cancel" element={<BookingCancellation />} />
        <Route path="/w/:hash" element={<WaitlistClaim />} />
        
        {/* Dashboard Routes */}
        <Route path="/setup" element={<BusinessSetup />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/dashboard/:slug" element={<DashboardLayout><CRMDashboard /></DashboardLayout>} />
        <Route path="/dashboard/:slug/calendar" element={<DashboardLayout><CRMCalendar /></DashboardLayout>} />
        <Route path="/dashboard/:slug/bookings" element={<DashboardLayout><BookingsList /></DashboardLayout>} />
        <Route path="/dashboard/:slug/services" element={<DashboardLayout><ServicesManager /></DashboardLayout>} />
        <Route path="/dashboard/:slug/staff" element={<DashboardLayout><StaffManager /></DashboardLayout>} />
        <Route path="/dashboard/:slug/clients" element={<DashboardLayout><ClientsDatabase /></DashboardLayout>} />
        <Route path="/dashboard/:slug/promocodes" element={<DashboardLayout><PromocodesManager /></DashboardLayout>} />
        <Route path="/dashboard/:slug/reviews" element={<DashboardLayout><ReviewsManager /></DashboardLayout>} />
        <Route path="/dashboard/:slug/portfolio" element={<DashboardLayout><PostsFeedWrapper /></DashboardLayout>} />
        <Route path="/dashboard/:slug/settings" element={<DashboardLayout><BusinessSettings /></DashboardLayout>} />
        
        <Route path="/ig/:slug" element={<InstagramLanding />} />
        <Route path="/review/:hash" element={<ReviewPage />} />
        <Route path="/profile" element={<ClientProfile />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="/rebook/:hash" element={<RebookPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
