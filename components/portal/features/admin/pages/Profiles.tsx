'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-browser';
import { Table } from '../../../components/Table';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import { Modal } from '../../../components/Modal';
import { Card } from '../../../components/Card';
import { api } from '../../assurance/api';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  employee_code: string;
  is_active: boolean;
  created_at: string;
}

const Profiles: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [password, setPassword] = useState('');

  // Fetch profiles
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Create/update profile mutation
  const profileMutation = useMutation({
    mutationFn: async (profile: Partial<Profile>) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const fields = {
        full_name: profile.full_name?.trim(),
        email: profile.email?.trim().toLowerCase(),
        employee_code: profile.employee_code?.trim() || '',
        role: profile.role,
        is_active: profile.is_active,
      };
      if (!fields.full_name || !fields.email) throw new Error('Name and email are required');
      if (isEditMode && selectedProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...fields, employee_code: fields.employee_code || null })
          .eq('id', selectedProfile.id)
          .select();
        if (error) throw error;
        if (!data?.length) throw new Error('No user was updated. Check that your account has permission to edit this user.');
        return data[0];
      } else {
        if (password.length < 8) throw new Error('Password must contain at least 8 characters');
        return api<Profile>('/profiles/accounts', {
          method: 'POST',
          body: JSON.stringify({ ...fields, password }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      void queryClient.resetQueries({queryKey:['route-access']});
      setIsModalOpen(false);
      setSelectedProfile(null);
      setPassword('');
    },
  });

  // Filter and search profiles
  const filteredProfiles = profiles?.filter(profile => {
    return (
      (searchTerm === '' ||
        profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (profile.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (profile.employee_code ?? '').toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterRole === '' || profile.role === filterRole)
    );
  }) || [];

  const handleEditProfile = (profile: Profile) => {
    profileMutation.reset();
    setSelectedProfile(profile);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleCreateProfile = () => {
    profileMutation.reset();
    setPassword('');
    setSelectedProfile({
      id: '',
      full_name: '',
      email: '',
      role: 'technician',
      employee_code: '',
      is_active: true,
      created_at: new Date().toISOString(),
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleSaveProfile = () => {
    if (selectedProfile) {
      profileMutation.mutate(selectedProfile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSelectedProfile(prev => prev ? { ...prev, [name]: name === 'is_active' ? value === 'true' : value } : null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-50">User Management</h1>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {profiles?.length || 0} users registered
          </p>
        </div>
        <Button variant="primary" onClick={handleCreateProfile}>
          Add User
        </Button>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <Input
            label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or employee code..."
            className="flex-1"
          />
          <Select
            label="Role"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'controller', label: 'Controller' },
              { value: 'technician', label: 'Technician' },
            ]}
            className="w-full md:w-48"
          />
        </div>

        <Table
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'employee_code', label: 'Employee Code' },
            { key: 'is_active', label: 'Status' },
            { key: 'created_at', label: 'Created At' },
            { key: 'actions', label: 'Actions' },
          ]}
          data={filteredProfiles.map(profile => ({
            ...profile,
            is_active: profile.is_active ? 'Active' : 'Inactive',
            created_at: new Date(profile.created_at).toLocaleString(),
            actions: (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditProfile(profile)}
              >
                Edit
              </Button>
            ),
          }))}
          isLoading={isLoading}
        />
      </Card>

      {/* Profile Modal */}
      {isModalOpen && selectedProfile && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={isEditMode ? 'Edit User' : 'Add User'}
          size="lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              name="full_name"
              value={selectedProfile.full_name}
              onChange={handleInputChange}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={selectedProfile.email}
              onChange={handleInputChange}
            />
            <Input
              label="Employee Code"
              name="employee_code"
              value={selectedProfile.employee_code ?? ''}
              onChange={handleInputChange}
            />
            {!isEditMode && (
              <Input
                label="Initial Password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters. Used for the new user's first sign-in."
              />
            )}
            <Select
              label="Role"
              name="role"
              value={selectedProfile.role}
              onChange={handleInputChange}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'controller', label: 'Controller' },
                { value: 'technician', label: 'Technician' },
              ]}
            />
            <Select
              label="Status"
              name="is_active"
              value={selectedProfile.is_active ? 'true' : 'false'}
              onChange={handleInputChange}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
            />
          </div>
          {profileMutation.isError && (
            <p role="alert" className="mt-4 text-sm text-danger-600 dark:text-danger-400">
              {profileMutation.error.message || 'Unable to save user details. Please try again.'}
            </p>
          )}
          <div className="mt-6 flex justify-end space-x-4">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              isLoading={profileMutation.isPending}
            >
              Save
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Profiles;
