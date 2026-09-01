"use client"

import { Header } from '@/components/ui/Header'
import { useTheme } from '@/context/ThemeContext'
import { Moon, Sun, ChevronRight, Package, CreditCard, Settings, HelpCircle, LogOut } from 'lucide-react'
import Image from 'next/image'

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme()

  const menuItems = [
    { icon: Package, label: 'My Orders', description: 'View and track your orders' },
    { icon: CreditCard, label: 'Payment Methods', description: 'Manage your saved cards' },
    { icon: Settings, label: 'Account Settings', description: 'Personal details and security' },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQ and contact information' },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header />
      
      <main className="px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-blue-400 p-[2px]">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=AppleUser&backgroundColor=transparent" 
                alt="Profile" 
                className="w-full h-full"
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">John Doe</h1>
            <p className="text-muted-foreground text-sm">john.doe@example.com</p>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <div className="font-semibold text-sm">Appearance</div>
              <div className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </div>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <div 
              className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} 
            />
          </button>
        </div>

        {/* Menu Items */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm mb-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button 
                key={item.label}
                className={`w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors ${
                  index !== menuItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-muted-foreground">
                    <Icon size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-muted-foreground/50" />
              </button>
            )
          })}
        </div>

        {/* Logout */}
        <button className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-semibold bg-red-500/10 hover:bg-red-500/20 rounded-2xl transition-colors">
          <LogOut size={20} />
          Sign Out
        </button>
      </main>
    </div>
  )
}
