import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./TermsModal.css";
import "./TermsMobile.css";

export function TermsModal({ onAccept, onCancel, theme }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Bloquear scroll del body al abrir el modal
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    
    // Restaurar scroll al cerrar/desmontar
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const modalContent = (
    <div className={`terms-overlay ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <div className="terms-modal shadow-2xl">
        <div className="terms-header">
          <div className="premium-eyebrow">Seguridad y Privacidad</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950">
            Declaración de responsabilidad sobre referidos
          </h2>
        </div>

        <div className="terms-content custom-scrollbar">
          <p className="mb-4 text-slate-600">Al ingresar un referido en esta plataforma, el usuario declara y acepta que:</p>
          <ol className="terms-list">
            <li>La información proporcionada es verídica, actualizada y corresponde a una persona real.</li>
            <li>Cuenta con el consentimiento previo, expreso e informado del referido para compartir sus datos personales con fines comerciales y de contacto.</li>
            <li>Se hace completamente responsable por la exactitud de los datos ingresados, liberando a la empresa de cualquier responsabilidad derivada de información incorrecta, incompleta o falsa.</li>
            <li>Se compromete a no ingresar datos sin autorización, ni utilizar la plataforma para fines indebidos, fraudulentos o contrarios a la ley.</li>
            <li>Entiende que el uso indebido de la plataforma podrá derivar en la suspensión o eliminación de su cuenta, sin perjuicio de las acciones legales que correspondan.</li>
            <li>Acepta que los datos ingresados serán tratados conforme a la política de privacidad de la empresa.</li>
          </ol>
          <p className="mt-4 font-semibold text-slate-800">
            Al continuar, el usuario confirma que ha leído y acepta esta declaración.
          </p>
        </div>

        <div className="terms-footer">
          <label className="terms-checkbox-container">
            <input 
              type="checkbox" 
              checked={accepted} 
              onChange={(e) => setAccepted(e.target.checked)} 
            />
            <span className="checkbox-text text-sm text-slate-600">
              He leído y acepto la Declaración de responsabilidad sobre referidos.
            </span>
          </label>

          <div className="terms-actions">
            <button 
              className="cancel-button" 
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button 
              className={`accept-button ${!accepted ? "disabled" : "premium-btn-active"}`}
              onClick={() => accepted && onAccept()}
              disabled={!accepted}
            >
              Aceptar y Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
