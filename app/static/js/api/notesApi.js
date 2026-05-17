"use strict";
// Notes API facade. Endpoint values come from the existing Jinja data attributes.
(function () {
    function fromConfig(config) {
        const http = window.MonHttp;
        return {
            getNotes() {
                return http.request(config.getNotesUrl);
            },
            addNote(payload) {
                return http.postJson(config.addNoteUrl, payload);
            },
            updateNote(noteId, payload) {
                return http.postJson(`${config.updateNoteBase}${noteId}`, payload);
            },
            deleteNote(noteId, method = "POST") {
                return http.request(`${config.deleteNoteBase}${noteId}`, { method });
            },
            toggleMark(noteId) {
                return http.request(`${config.toggleMarkBase}${noteId}`, { method: "POST" });
            }
        };
    }
    window.NotesApiFactory = { fromConfig };
})();
