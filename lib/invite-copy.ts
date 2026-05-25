import type { InviteLocale } from "./types";

export const inviteCopy = {
  en: {
    metaTitle: "You’re invited",
    greeting: (name: string) => `Dear ${name},`,
    plusOne: "Your invitation includes a +1.",
    plusOneNone:
      "This invitation is for you only (no +1). You can ask the hosts to add a guest before you respond.",
    plusOneRequestBtn: "Request to bring a guest (+1)",
    plusOneRequestPending:
      "You’ve asked to bring a guest. The hosts will review your request.",
    plusOneRequestRejectedTitle: "Your request to bring a guest (+1) was declined.",
    plusOneRequestRejectedBody:
      "You can try sending a new request below, or reach out to the event hosts directly if you’d prefer to discuss it.",
    plusOneRequestAgainBtn: "Request again (+1)",
    plusOneRequestSent: "Request sent. The hosts will review it soon.",
    plusOneRequestBusy: "Sending…",
    loading: "Loading your invitation…",
    confirmBtn: "Confirm attendance",
    declineBtn: "Decline",
    wishesLabel: "Wedding wishes or message (optional)",
    wishesPlaceholder: "Share a short wish for us…",
    submitWish: "Submit confirmation",
    back: "Back",
    declineConfirm:
      "Are you sure you want to decline? You can contact the hosts if you change your mind.",
    declineYes: "Yes, decline",
    thankYou: "Thank you!",
    acceptedLead:
      "We’re so glad you can celebrate with us. Your details are below.",
    eventHeading: "Event details",
    eventRsvpHint:
      "Review the details below, then confirm attendance or decline.",
    rsvpDeadlineTitle: "RSVP deadline",
    rsvpDeadlineRespondBy: "Respond by",
    rsvpDeadlineTimeLeft: "Time remaining",
    rsvpDeadlinePolicy:
      "Please accept or decline before this time. If you don’t respond in time, your place may be offered to another guest.",
    eventDetailsPending:
      "Event details will appear here once the hosts add them.",
    getDirections: "Get directions",
    redirectingIn: (s: string) => `Redirecting in ${s}s…`,
    redirectNow: "Go now",
    realInvitationLabel: "Wedding invitation",
    realInvitationNotice: "Please do not share this link publicly. It is intended for you only.",
    expiredTitle: "This invitation has expired",
    expiredBody:
      "The RSVP window for this link has closed. If you think this is a mistake, please reach out to the hosts.",
    revokedTitle: "This invitation is no longer valid",
    revokedBody:
      "This link has been withdrawn. If you have questions, please contact the hosts.",
    declinedTitle: "You’ve declined this invitation",
    declinedBody: "Thank you for letting us know. We’ll miss you!",
    notFoundTitle: "Invitation not found",
    notFoundBody: "This link may be incorrect or no longer available.",
  },
  id: {
    metaTitle: "Undangan",
    greeting: (name: string) => `Kepada ${name},`,
    plusOne: "Undangan ini mencakup +1.",
    plusOneNone:
      "Undangan ini hanya untuk Anda (tanpa +1). Anda bisa meminta tuan rumah menambahkan tamu sebelum merespons.",
    plusOneRequestBtn: "Minta bawa tamu (+1)",
    plusOneRequestPending:
      "Anda sudah meminta membawa tamu. Tuan rumah akan meninjau.",
    plusOneRequestRejectedTitle: "Permintaan Anda untuk membawa tamu (+1) ditolak.",
    plusOneRequestRejectedBody:
      "Anda boleh mencoba mengirim permintaan baru di bawah, atau menghubungi tuan rumah acara secara langsung jika ingin membicarakannya.",
    plusOneRequestAgainBtn: "Minta lagi (+1)",
    plusOneRequestSent: "Permintaan terkirim. Tuan rumah akan meninjaunya di dasbor mereka.",
    plusOneRequestBusy: "Mengirim…",
    loading: "Memuat undangan…",
    confirmBtn: "Konfirmasi hadir",
    declineBtn: "Tidak dapat hadir",
    wishesLabel: "Ucapan / harapan (opsional)",
    wishesPlaceholder: "Tulis ucapan singkat…",
    submitWish: "Kirim konfirmasi",
    back: "Kembali",
    declineConfirm:
      "Yakin ingin menolak undangan? Jika berubah pikiran, hubungi kami.",
    declineYes: "Ya, tolak",
    thankYou: "Terima kasih!",
    acceptedLead: "Senang sekali Anda bisa hadir. Rincian acara ada di bawah.",
    eventHeading: "Detail acara",
    eventRsvpHint:
      "Tinjau rincian di bawah, lalu konfirmasi kehadiran atau tolak undangan.",
    rsvpDeadlineTitle: "Batas konfirmasi RSVP",
    rsvpDeadlineRespondBy: "Konfirmasi sebelum",
    rsvpDeadlineTimeLeft: "Sisa waktu",
    rsvpDeadlinePolicy:
      "Silakan konfirmasi hadir atau tolak sebelum waktu ini. Jika tidak ada tanggapan tepat waktu, tempat Anda dapat ditawarkan ke tamu lain.",
    eventDetailsPending:
      "Rincian acara akan muncul di sini setelah dipasang oleh tuan rumah.",
    getDirections: "Petunjuk arah",
    redirectingIn: (s: string) => `Mengarahkan dalam ${s}d…`,
    redirectNow: "Buka sekarang",
    realInvitationLabel: "Undangan pernikahan",
    realInvitationNotice: "Mohon jangan membagikan tautan ini secara publik. Tautan ini hanya untuk Anda.",
    expiredTitle: "Undangan ini sudah berakhir",
    expiredBody:
      "Batas konfirmasi untuk tautan ini sudah lewat. Jika ini kesalahan, silakan hubungi kami.",
    revokedTitle: "Undangan ini tidak lagi berlaku",
    revokedBody:
      "Tautan ini telah ditarik. Jika ada pertanyaan, silakan hubungi kami.",
    declinedTitle: "Anda telah menolak undangan",
    declinedBody: "Terima kasih atas konfirmasinya — sampai jumpa lain waktu!",
    notFoundTitle: "Undangan tidak ditemukan",
    notFoundBody: "Tautan mungkin salah atau tidak lagi tersedia.",
  },
} satisfies Record<
  InviteLocale,
  Record<string, string | ((name: string) => string)>
>;
