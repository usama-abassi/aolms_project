'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-browser';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Modal } from '../../../components/Modal';
import { Card } from '../../../components/Card';
import { FolderKanban, Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const Projects: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('display_order').order('name').order('id');
      if (error) throw error;
      return data as Project[];
    },
  });

  // Create/update project mutation
  const projectMutation = useMutation({
    mutationFn: async (project: Partial<Project>) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      if (isEditMode && selectedProject) {
        const { data, error } = await supabase
          .from('projects')
          .update(project)
          .eq('id', selectedProject.id)
          .select();
        if (error) throw error;
        if (!data?.length) throw new Error('Project was not updated. Check your permissions and try again.');
        return data[0];
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert(project)
          .select();
        if (error) throw error;
        if (!data?.length) throw new Error('Project was not created. Please try again.');
        return data[0];
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['controller-projects'] });
      setIsModalOpen(false);
      setSelectedProject(null);
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleEditProject = (project: Project) => {
    projectMutation.reset();
    setValidationError('');
    setSelectedProject(project);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleCreateProject = () => {
    projectMutation.reset();
    setValidationError('');
    setSelectedProject({
      id: '',
      name: '',
      code: '',
      is_active: true,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
    setIsEditMode(false);
  };

  const handleDeleteProject = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const handleSaveProject = () => {
    setValidationError('');
    const name = selectedProject?.name.trim();
    const code = selectedProject?.code.trim().toUpperCase();
    const isActive = selectedProject?.is_active;
    const displayOrder = Number(selectedProject?.display_order ?? 0);
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 2147483647) {
      setValidationError('Display order must be a whole number from 0 to 2147483647.');
      return;
    }
    if (name && code && isActive !== undefined) {
      projectMutation.mutate({ name, code, is_active: isActive, display_order: displayOrder });
    } else {
      setValidationError('Enter both a project name and project code.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSelectedProject(prev => prev ? { ...prev, [name]: value } : null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-50">Projects</h1>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {projects?.length || 0} projects configured
            {' · Edit Display order to arrange projects for Admin and Controllers; lower numbers appear first.'}
          </p>
        </div>
        <Button variant="primary" onClick={handleCreateProject} leftIcon={<Plus className="w-4 h-4" />}>
          Add Project
        </Button>
      </div>

      <div className="grid gap-4">
        {error && (
          <Card className="flex items-start gap-3 border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-950/30">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
            <div><p className="font-medium text-danger-700 dark:text-danger-300">Projects could not be loaded</p><p className="text-sm text-danger-600 dark:text-danger-400">{error.message}</p></div>
          </Card>
        )}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingState/>
          </div>
        ) : projects?.length === 0 ? (
          <Card className="text-center py-12">
            <FolderKanban className="w-12 h-12 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" aria-hidden="true" />
            <h3 className="text-h5 font-medium text-neutral-900 dark:text-neutral-50 mb-2">No projects yet</h3>
            <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mb-4">Get started by creating your first project</p>
            <Button variant="primary" onClick={handleCreateProject} leftIcon={<Plus className="w-4 h-4" />}>
              Add Project
            </Button>
          </Card>
        ) : (
          projects?.map(project => (
            <Card key={project.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-950 flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-body-md font-semibold text-neutral-900 dark:text-neutral-50 truncate">
                    {project.name}
                  </h3>
                  <p className="text-caption text-neutral-500 dark:text-neutral-400 font-mono">{project.code}</p>
                  <p className="text-xs text-neutral-500">Display order: {project.display_order}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 ml-4">
                  {project.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-caption font-medium bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400">
                      <CheckCircle className="w-3 h-3" aria-hidden="true" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-caption font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      <XCircle className="w-3 h-3" aria-hidden="true" />
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditProject(project)}
                  leftIcon={<Edit className="w-4 h-4" />}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteProject(project)}
                  disabled={deleteMutation.isPending}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/30"
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Project Modal */}
      {isModalOpen && selectedProject && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={isEditMode ? 'Edit Project' : 'Add Project'}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveProject} isLoading={projectMutation.isPending}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {(validationError || projectMutation.isError) && (
              <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">
                {validationError || projectMutation.error?.message || 'Unable to save project.'}
              </p>
            )}
            <Input
              label="Project Name"
              name="name"
              value={selectedProject.name}
              onChange={handleInputChange}
              placeholder="e.g., Service Assurance"
              required
              autoFocus
            />
            <Input
              label="Project Code"
              name="code"
              value={selectedProject.code}
              onChange={handleInputChange}
              placeholder="e.g., SERVICE_DELIVERY"
              required
              className="uppercase"
            />
            <Input label="Display order" type="number" name="display_order" min={0} step={1}
              value={selectedProject.display_order} onChange={handleInputChange}
              hint="Lower numbers appear first for Admin and Controllers. Ties are sorted by project name." />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Projects;
