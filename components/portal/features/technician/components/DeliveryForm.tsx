'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import React, { useState, useEffect } from 'react';
import {useParams,useRouter} from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import { Textarea } from '../../../components/Textarea';
import { supabase } from '@/lib/supabase-browser';
import { Card } from '../../../components/Card';
import { Save, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { currentUserId } from '../../assurance/api';

interface DeliverySubmission {
  id: string;
  order_id: string;
  technician_id: string;
  status: string;
  last_saved_at: string;
  submitted_at: string | null;
  edit_deadline: string | null;
  response_order_type: string | null;
  response_connection_type: string | null;
  actioned: string;
  sub_root_cause: string | null;
  item_category: string | null;
  ont_protection: string | null;
  internal_wiring: string | null;
  actual_actioned_item: string | null;
  actual_actioned_sub_item: string | null;
  cable_type: string | null;
  cable_length: number | null;
  conduit_clearance: string | null;
  conduit_pipe: string | null;
  pvc_trunk: string | null;
  total_conduit: number | null;
  mims_sn: string | null;
  nce_sn: string | null;
  ap1_sn: string | null;
  ap2_sn: string | null;
  ap3_sn: string | null;
  ap4_sn: string | null;
  retrieved_cpe: string | null;
  remarks: string | null;
}

const DeliveryForm: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<DeliverySubmission>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const user = useQuery({ queryKey: ['session-user-id'], queryFn: currentUserId });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);

  const fetchOrder = async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data;
  };

  const fetchDeliverySubmission = async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('delivery_submissions')
      .select('*')
      .eq('order_id', orderId)
      .eq('technician_id', user.data!)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  };

  const { data: order, isPending: orderLoading, error: orderError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: fetchOrder,
  });

  const { data: submission, isPending: submissionLoading, error: submissionError } = useQuery({
    queryKey: ['deliverySubmission', orderId, user.data],
    queryFn: fetchDeliverySubmission,
    enabled: !!user.data,
  });

  const isEditAllowed = !submissionLoading && !submissionError && !!user.data && order?.technician_id === user.data && order?.action === 'Delivered'
    && submission?.status !== 'locked'
    && (!submission?.submitted_at || now < new Date(submission.submitted_at).getTime() + 86400000);

  useEffect(() => {
    if (order && submission) {
      setFormData(submission);
    } else if (order) {
      setFormData({
        order_id: orderId,
        technician_id: user.data,
        status: 'draft',
        last_saved_at: new Date().toISOString(),
      });
    }
  }, [order, submission, orderId, user.data]);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: Partial<DeliverySubmission>) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      if (!isEditAllowed) throw new Error('This form is no longer editable');
      if (submission) {
        const { data: updatedData, error } = await supabase
          .from('delivery_submissions')
          .update({ ...data, last_saved_at: new Date().toISOString() })
          .eq('id', submission.id)
          .select();
        if (error) throw error;
        if (!updatedData?.length) throw new Error('Form was not saved. The edit window may have expired.');
        return updatedData[0];
      } else {
        const { data: newData, error } = await supabase
          .from('delivery_submissions')
          .insert({ ...data, last_saved_at: new Date().toISOString() })
          .select();
        if (error) throw error;
        return newData[0];
      }
    },
    onSuccess: (savedData) => {
      setFormData(savedData);
      setIsDraftSaved(true);
      queryClient.invalidateQueries({ queryKey: ['deliverySubmission', orderId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks'] });
      setTimeout(() => setIsDraftSaved(false), 3000);
    },
  });

  const submitFormMutation = useMutation({
    mutationFn: async (data: Partial<DeliverySubmission>) => {
      if (!supabase) throw new Error('Supabase client not initialized');
      if (!isEditAllowed) throw new Error('This form is no longer editable');
      const submittedAt = submission?.submitted_at || new Date().toISOString();
      const submissionData = {
        ...data,
        status: 'submitted',
        submitted_at: submittedAt,
        edit_deadline: new Date(new Date(submittedAt).getTime() + 86400000).toISOString(),
      };

      if (submission) {
        const { data: updatedData, error } = await supabase
          .from('delivery_submissions')
          .update(submissionData)
          .eq('id', submission.id)
          .select();
        if (error) throw error;
        if (!updatedData?.length) throw new Error('Form was not saved. The edit window may have expired.');
        return updatedData[0];
      } else {
        const { data: newData, error } = await supabase
          .from('delivery_submissions')
          .insert(submissionData)
          .select();
        if (error) throw error;
        return newData[0];
      }
    },
    onSuccess: (submittedData) => {
      setFormData(submittedData);
      queryClient.invalidateQueries({ queryKey: ['deliverySubmission', orderId] });
      queryClient.invalidateQueries({ queryKey: ['delivery-tasks'] });
      router.push('/technician/todo');
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate(formData);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    submitFormMutation.mutate(formData);
  };

  const timeLeft = submission?.edit_deadline
    ? Math.max(0, new Date(submission.edit_deadline).getTime() - Date.now())
    : null;

  const formatTimeLeft = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  if (user.error || orderError || submissionError) return <p role="alert">{user.error?.message || orderError?.message || submissionError?.message}</p>;
  if (user.isPending || orderLoading || submissionLoading) return <LoadingState message="Loading delivery form…"/>;
  if (!order) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-neutral-500 dark:text-neutral-400">Order not found</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 break-words sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-50">Delivery Form</h1>
        <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Order #{order.order_number}
        </p>
      </div>

      {/* Order Details - Controller Provided */}
      <Card title="Order Details" subtitle="Controller-provided information">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Work Date</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">
              {order.work_date ? new Date(order.work_date).toLocaleDateString() : '-'}
            </p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Exchange</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.exchange || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Block</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.block || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Road</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.road || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Building</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.building || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Flat</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.flat || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Package</p>
            <p className="text-body-md font-medium text-neutral-900 dark:text-neutral-50 mt-1">{order.package || '-'}</p>
          </div>
          <div>
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Action</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption font-medium mt-1 ${
              order.action === 'Delivered'
                ? 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                : 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400'
            }`}>
              {order.action || '-'}
            </span>
          </div>
        </div>
      </Card>

      {/* Technician Form */}
      {(saveDraftMutation.error || submitFormMutation.error) && <p role="alert" className="text-danger-600">{saveDraftMutation.error?.message || submitFormMutation.error?.message}</p>}
      <Card title="Delivery Information" subtitle="Technician-entered information">
        <form className="space-y-6">
          {/* Section 1: Action & Root Cause */}
          <div className="space-y-4">
            <h3 className="text-label-lg font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 pb-2">Action & Root Cause</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Order Type" name="response_order_type" value={formData.response_order_type || ''} onChange={handleChange} disabled={!isEditAllowed} placeholder="e.g. New, Internal, External" />
              <Input label="Connection Type" name="response_connection_type" value={formData.response_connection_type || ''} onChange={handleChange} disabled={!isEditAllowed} placeholder="e.g. Home Pass, Home Connect" />
              <Select
                label="Actioned"
                name="actioned"
                value={formData.actioned || ''}
                onChange={handleChange}
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
                disabled={!isEditAllowed}
              />
              <Input
                label="Sub Root Cause"
                name="sub_root_cause"
                value={formData.sub_root_cause || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Item Category"
                name="item_category"
                value={formData.item_category || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
            </div>
          </div>

          {/* Section 2: Equipment & Protection */}
          <div className="space-y-4">
            <h3 className="text-label-lg font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 pb-2">Equipment & Protection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="ONT Protection"
                name="ont_protection"
                value={formData.ont_protection || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Internal Wiring"
                name="internal_wiring"
                value={formData.internal_wiring || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Actual Actioned Item"
                name="actual_actioned_item"
                value={formData.actual_actioned_item || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Actual Actioned Sub Item"
                name="actual_actioned_sub_item"
                value={formData.actual_actioned_sub_item || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
            </div>
          </div>

          {/* Section 3: Cable & Conduit */}
          <div className="space-y-4">
            <h3 className="text-label-lg font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 pb-2">Cable & Conduit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Cable Type"
                name="cable_type"
                value={formData.cable_type || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Cable Length (m)"
                name="cable_length"
                type="number"
                value={formData.cable_length || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Conduit Clearance"
                name="conduit_clearance"
                value={formData.conduit_clearance || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Conduit Pipe"
                name="conduit_pipe"
                value={formData.conduit_pipe || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="PVC Trunk"
                name="pvc_trunk"
                value={formData.pvc_trunk || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="Total Conduit (m)"
                name="total_conduit"
                type="number"
                value={formData.total_conduit || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
            </div>
          </div>

          {/* Section 4: Device Serial Numbers */}
          <div className="space-y-4">
            <h3 className="text-label-lg font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 pb-2">Device Serial Numbers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="MIMS SN"
                name="mims_sn"
                value={formData.mims_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="NCE SN"
                name="nce_sn"
                value={formData.nce_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="AP1 SN"
                name="ap1_sn"
                value={formData.ap1_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="AP2 SN"
                name="ap2_sn"
                value={formData.ap2_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="AP3 SN"
                name="ap3_sn"
                value={formData.ap3_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <Input
                label="AP4 SN"
                name="ap4_sn"
                value={formData.ap4_sn || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
            </div>
          </div>

          {/* Section 5: CPE & Remarks */}
          <div className="space-y-4">
            <h3 className="text-label-lg font-medium text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-700 pb-2">CPE & Remarks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Retrieved CPE"
                name="retrieved_cpe"
                value={formData.retrieved_cpe || ''}
                onChange={handleChange}
                disabled={!isEditAllowed}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Remarks"
                  name="remarks"
                  value={formData.remarks || ''}
                  onChange={handleChange}
                  disabled={!isEditAllowed}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Edit Deadline Warning */}
          {isEditAllowed && submission?.status === 'submitted' && timeLeft && (
            <div className="flex items-center gap-2 p-3 bg-warning-50 dark:bg-warning-950 border border-warning-200 dark:border-warning-800 rounded-md">
              <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400" aria-hidden="true" />
              <span className="text-body-sm text-warning-700 dark:text-warning-300">
                You can edit this submission for {formatTimeLeft(timeLeft)}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="form-actions border-t border-neutral-200 dark:border-neutral-700">
            {isEditAllowed && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveDraft}
                isLoading={saveDraftMutation.isPending}
                disabled={isSubmitting}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Draft
              </Button>
            )}
            {isDraftSaved && (
              <span className="text-body-sm text-success-600 dark:text-success-400 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                Draft saved!
              </span>
            )}
            {isEditAllowed && (
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={saveDraftMutation.isPending}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Submit
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default DeliveryForm;
