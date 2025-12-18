import { useState } from 'react';
import { Camera, Users, CheckCircle, Shield, Clock, Award, TrendingUp, Mail, Phone, MapPin, Send, Zap, Target } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

interface HomeProps {
  onLogin: () => void;
}

export function Home({ onLogin }: HomeProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('success');
    setTimeout(() => {
      setFormData({ name: '', email: '', phone: '', message: '' });
      setSubmitStatus('idle');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#0B6CF9] to-[#0A5CD7] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Camera className="text-white" size={24} />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-[#0B6CF9] to-[#0A5CD7] bg-clip-text text-transparent">FaceXam</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#services" className="text-gray-600 hover:text-[#0B6CF9] transition-colors font-medium hidden sm:block">Services</a>
              <a href="#why-us" className="text-gray-600 hover:text-[#0B6CF9] transition-colors font-medium hidden sm:block">Why Us</a>
              <a href="#contact" className="text-gray-600 hover:text-[#0B6CF9] transition-colors font-medium hidden sm:block">Contact</a>
              <Button onClick={onLogin}>Sign In</Button>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F7F9FC] via-white to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-50 text-[#0B6CF9] px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <Zap size={16} />
                Next-Gen Attendance System
              </div>
              <h1 className="text-5xl sm:text-6xl font-bold text-[#0F172A] mb-6 leading-tight">
                Transform Your
                <span className="bg-gradient-to-r from-[#0B6CF9] to-[#0A5CD7] bg-clip-text text-transparent"> Attendance Management</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Harness the power of face recognition technology to streamline attendance tracking, generate hall tickets instantly, and eliminate manual processes forever.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onLogin} size="lg" className="text-lg px-8 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all">
                  Get Started Free
                </Button>
                <Button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} size="lg" variant="outline" className="text-lg px-8">
                  Contact Sales
                </Button>
              </div>
              <div className="flex items-center gap-8 mt-10">
                <div>
                  <div className="text-3xl font-bold text-[#0F172A]">99.9%</div>
                  <div className="text-sm text-gray-600">Accuracy Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#0F172A]">2 sec</div>
                  <div className="text-sm text-gray-600">Check-in Time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#0F172A]">24/7</div>
                  <div className="text-sm text-gray-600">Support</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative bg-gradient-to-br from-[#0B6CF9] to-[#0A5CD7] rounded-3xl p-8 shadow-2xl shadow-blue-500/30">
                <div className="bg-white rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                      <Camera className="text-[#0B6CF9]" size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded-full w-32 mb-2"></div>
                      <div className="h-2 bg-gray-100 rounded-full w-24"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-gradient-to-r from-[#0B6CF9] to-[#0A5CD7] rounded-full w-full"></div>
                    <div className="h-2 bg-gradient-to-r from-[#16A34A] to-[#15803D] rounded-full w-5/6"></div>
                    <div className="h-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded-full w-4/6"></div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                  <CheckCircle className="text-[#16A34A]" size={48} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0F172A] mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive solutions designed to revolutionize your educational institution's attendance and examination processes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-[#0B6CF9]">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Camera className="text-[#0B6CF9]" size={32} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-[#0F172A]">Face Recognition Attendance</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Advanced AI-powered facial recognition technology ensures accurate, contactless attendance marking in seconds. No more manual registers or proxy attendance.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    99.9% accuracy rate
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Real-time processing
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Anti-spoofing protection
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-[#16A34A]">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="text-[#16A34A]" size={32} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-[#0F172A]">Real-time Analytics</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Comprehensive dashboards provide instant insights into attendance patterns, class participation, and student engagement metrics.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Live attendance tracking
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Custom reports generation
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Automated notifications
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-[#F59E0B]">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Award className="text-[#F59E0B]" size={32} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-[#0F172A]">Hall Ticket Generation</h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Automated hall ticket creation with student photos, attendance criteria verification, and instant download capabilities for hassle-free exam management.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Instant generation
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    Attendance validation
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-[#16A34A]" />
                    PDF download
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="why-us" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F7F9FC] to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0F172A] mb-4">Why Choose FaceXam?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We combine cutting-edge technology with user-friendly design to deliver unmatched value
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Zap className="text-[#0B6CF9]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Lightning Fast</h3>
                <p className="text-gray-600 leading-relaxed">
                  Mark attendance for entire classes in under 2 minutes. Save hours of administrative time every week.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <Shield className="text-[#16A34A]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Bank-Grade Security</h3>
                <p className="text-gray-600 leading-relaxed">
                  Enterprise-level encryption and secure data storage ensure complete protection of sensitive information.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Target className="text-[#F59E0B]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">99.9% Accuracy</h3>
                <p className="text-gray-600 leading-relaxed">
                  State-of-the-art AI algorithms deliver exceptional accuracy, eliminating errors and proxy attendance.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                  <Clock className="text-[#EF4444]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">24/7 Support</h3>
                <p className="text-gray-600 leading-relaxed">
                  Round-the-clock technical support and dedicated account managers ensure smooth operations always.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users className="text-[#9333EA]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Easy Integration</h3>
                <p className="text-gray-600 leading-relaxed">
                  Seamless integration with existing systems. Get up and running in days, not months.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-[#14B8A6]" size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-[#0F172A]">Scalable Solution</h3>
                <p className="text-gray-600 leading-relaxed">
                  Built to grow with you. From small classes to large universities, we scale effortlessly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#0B6CF9] to-[#0A5CD7]">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold mb-8 text-center text-white">Try Demo Accounts</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <Shield size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Admin Account</h3>
                      <p className="text-sm text-blue-100">Full system access</p>
                    </div>
                  </div>
                  <div className="space-y-2 bg-white/10 rounded-lg p-4 font-mono text-sm">
                    <div className="text-white">
                      <span className="text-blue-200">Email:</span> admin@facexam.demo
                    </div>
                    <div className="text-white">
                      <span className="text-blue-200">Password:</span> admin123
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <Users size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Student Account</h3>
                      <p className="text-sm text-blue-100">View attendance & hall tickets</p>
                    </div>
                  </div>
                  <div className="space-y-2 bg-white/10 rounded-lg p-4 font-mono text-sm">
                    <div className="text-white">
                      <span className="text-blue-200">Email:</span> student@facexam.demo
                    </div>
                    <div className="text-white">
                      <span className="text-blue-200">Password:</span> student123
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-8">
                <Button
                  onClick={onLogin}
                  size="lg"
                  className="bg-white text-[#0B6CF9] hover:bg-gray-100 shadow-lg"
                >
                  Try Demo Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-4xl font-bold text-[#0F172A] mb-4">Get In Touch</h2>
              <p className="text-xl text-gray-600 mb-8">
                Ready to transform your attendance management? Contact us today for a personalized demo and consultation.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="text-[#0B6CF9]" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] mb-1">Email Us</h3>
                    <p className="text-gray-600">contact@facexam.com</p>
                    <p className="text-gray-600">support@facexam.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="text-[#16A34A]" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] mb-1">Call Us</h3>
                    <p className="text-gray-600">+91 (800) 123-4567</p>
                    <p className="text-gray-600">Mon-Fri: 9AM - 6PM IST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="text-[#F59E0B]" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] mb-1">Visit Us</h3>
                    <p className="text-gray-600">123 Tech Park, Innovation Drive</p>
                    <p className="text-gray-600">Bangalore, Karnataka 560001</p>
                  </div>
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your requirements..."
                      rows={4}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  {submitStatus === 'success' && (
                    <div className="bg-green-50 text-[#16A34A] px-4 py-3 rounded-lg flex items-center gap-2">
                      <CheckCircle size={20} />
                      <span>Message sent successfully! We'll get back to you soon.</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg">
                    <Send size={20} className="mr-2" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="bg-[#0F172A] text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0B6CF9] to-[#0A5CD7] rounded-xl flex items-center justify-center">
                  <Camera className="text-white" size={24} />
                </div>
                <span className="text-2xl font-bold">FaceXam</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Transform your institution with AI-powered attendance and hall ticket management.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#services" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#why-us" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2024 FaceXam. All rights reserved. Powered by cutting-edge AI technology.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
