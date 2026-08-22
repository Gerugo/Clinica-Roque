/**
 * Servicio de impresión de tickets en papel físico
 * Diseñado especialmente para personas mayores y usuarios sin smartphone / QR.
 * Utiliza un iframe oculto para evitar bloqueos por parte del bloqueador de popups del navegador.
 */

export function imprimirTicketPapel(nombreSala, numeroTurno) {
  const fecha = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const hora = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Ticket Clínica Roque - ${numeroTurno}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
            color: #000;
            background: #fff;
            padding: 12px;
          }
          .ticket-card {
            max-width: 320px;
            margin: 0 auto;
            border: 2px solid #000;
            border-radius: 12px;
            padding: 16px;
          }
          .header-clinic {
            font-size: 1.4rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .header-sub {
            font-size: 0.95rem;
            color: #333;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .room-badge {
            background-color: #000;
            color: #fff;
            font-size: 1.15rem;
            font-weight: bold;
            padding: 6px 12px;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 14px;
            text-transform: uppercase;
          }
          .divider {
            border-top: 2px dashed #000;
            margin: 12px 0;
          }
          .ticket-label {
            font-size: 1rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .ticket-number {
            font-size: 5rem;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 4px;
            margin: 8px 0;
            font-family: 'Courier New', monospace;
          }
          .instructions {
            font-size: 1rem;
            line-height: 1.4;
            margin: 12px 0 6px 0;
            font-weight: 600;
          }
          .instructions-sub {
            font-size: 0.9rem;
            color: #444;
          }
          .timestamp-box {
            font-size: 0.8rem;
            color: #555;
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
          }
          @media print {
            @page {
              margin: 0;
              size: auto;
            }
            body {
              padding: 0;
              margin: 0;
            }
            .ticket-card {
              border: none;
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="ticket-card">
          <div class="header-clinic">Clínica Roque</div>
          <div class="header-sub">Gestión de Sala de Espera</div>

          <div class="room-badge">${nombreSala}</div>

          <div class="divider"></div>

          <div class="ticket-label">SU NÚMERO DE TURNO:</div>
          <div class="ticket-number">${numeroTurno}</div>

          <div class="divider"></div>

          <div class="instructions">Por favor, tome asiento en la sala.</div>
          <div class="instructions-sub">Le avisaremos por las pantallas de TV y por sonido cuando sea su turno.</div>

          <div class="timestamp-box">
            ${fecha}<br />
            <strong>Hora: ${hora}</strong>
          </div>
        </div>
      </body>
    </html>
  `

  // 1. Intentar imprimir mediante iframe oculto (sin popups bloqueados)
  try {
    let iframe = document.getElementById('ticket-print-iframe')
    if (iframe) {
      document.body.removeChild(iframe)
    }

    iframe = document.createElement('iframe')
    iframe.id = 'ticket-print-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'

    document.body.appendChild(iframe)

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(htmlContent)
    doc.close()

    iframe.contentWindow.focus()
    setTimeout(() => {
      iframe.contentWindow.print()
    }, 250)

    return true
  } catch (error) {
    console.warn('Fallo impresión por iframe, usando fallback de ventana:', error)

    // 2. Fallback de ventana con comprobación de null
    const printWindow = window.open('', '_blank', 'width=420,height=600')
    if (!printWindow) {
      alert(
        'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para imprimir tickets en papel.'
      )
      return false
    }

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      setTimeout(() => {
        try {
          printWindow.close()
        } catch {
          // Ignorar fallo al cerrar ventana
        }
      }, 500)
    }, 250)

    return true
  }
}
