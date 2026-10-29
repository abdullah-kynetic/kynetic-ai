export {
  availableSlots,
  type AvailabilityAppointment,
  type AvailabilityInput
} from './availability';
export {
  availabilityInputSchema,
  bookAppointment,
  listAppointments,
  updateAppointment,
  cancelAppointment,
  listAvailableSlots,
  type Appointment,
  type AvailabilityInput as BookingAvailabilityInput,
  type BookAppointmentInput
} from './service';
export { registerAppointmentSubscriber } from './events';
